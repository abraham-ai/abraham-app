import { NextRequest, NextResponse } from "next/server";
import {
  SubgraphCreation,
  CreationItem,
  SubgraphMessage,
  Blessing,
} from "@/types/abraham";

export const revalidate = 0;

const ENDPOINT =
  "https://api.studio.thegraph.com/query/102152/abraham/version/latest";

const OWNER = (process.env.NEXT_PUBLIC_OWNER_ADDRESS || "").toLowerCase();

const PREFERRED_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://cloudflare-ipfs.com/ipfs/";
const IPFS_GATEWAYS = [
  PREFERRED_GATEWAY,
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
] as const;

// For first load: fetch a small recent window and hydrate only
// the latest Abraham + its attached blessings.
const TAIL_FIRST_LOAD = 48;

/* -------- GraphQL -------- */
const DETAIL_QUERY_LITE = /* GraphQL */ `
  query OneLite($id: ID!, $tail: Int!, $owner: Bytes!) {
    creation(id: $id) {
      id
      closed
      ethSpent
      firstMessageAt
      lastActivityAt
      # latest Abraham message (has CID)
      abrahamLatest: messages(
        first: 1
        orderBy: timestamp
        orderDirection: desc
        where: { author: $owner }
      ) {
        uuid
        author
        cid
        praiseCount
        timestamp
      }
      # short recent tail (DESC) with CIDs so we can hydrate just what we need
      tail: messages(first: $tail, orderBy: timestamp, orderDirection: desc) {
        uuid
        author
        cid
        praiseCount
        timestamp
      }
    }
  }
`;

const DETAIL_QUERY_FULL = /* GraphQL */ `
  query OneFull($id: ID!, $msgLimit: Int!, $owner: Bytes!) {
    creation(id: $id) {
      id
      closed
      ethSpent
      firstMessageAt
      lastActivityAt
      messages(first: $msgLimit, orderBy: timestamp, orderDirection: asc) {
        uuid
        author
        cid
        praiseCount
        timestamp
      }
      abrahamLatest: messages(
        first: 1
        orderBy: timestamp
        orderDirection: desc
        where: { author: $owner }
      ) {
        uuid
        author
        cid
        praiseCount
        timestamp
      }
    }
  }
`;

/* -------- IPFS helpers + LRU -------- */
type IpfsMediaItem = { src: string; type?: string; mime?: string };
type IpfsMessageJSON = {
  version?: number;
  sessionId?: string;
  messageId?: string;
  author?: string;
  kind?: "owner" | "blessing" | string;
  content?: string;
  media?: IpfsMediaItem[];
  createdAt?: number;
};

function normalizeCidToPath(cid: string): string {
  const clean = cid.replace(/^ipfs:\/\//i, "");
  const parts = clean.split("/");
  const root = parts[0];
  const rest = parts.slice(1).join("/");
  return rest ? `${root}/${rest}` : root;
}
function toGatewayUrl(cidOrSrc: string, base: string): string {
  if (/^https?:\/\//i.test(cidOrSrc)) return cidOrSrc;
  const b = base.endsWith("/") ? base : base + "/";
  return b + normalizeCidToPath(cidOrSrc);
}
async function fetchWithTimeout(url: string, ms = 7000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      cache: "force-cache", // immutable by CID
      next: { revalidate: 60 * 60 * 24 },
      headers: { Accept: "application/json" },
    });
  } finally {
    clearTimeout(id);
  }
}

type CacheEntry = { value: IpfsMessageJSON | null; expiresAt: number };
const CID_LRU_MAX = 5000;
const CID_TTL_MS = 1000 * 60 * 60 * 12; // 12h
const cidLRU: Map<string, CacheEntry> =
  (global as any).__ipfs_json_lru_detail_fast__ || new Map();
(global as any).__ipfs_json_lru_detail_fast__ = cidLRU;

function lruGet(key: string): IpfsMessageJSON | null | undefined {
  const hit = cidLRU.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cidLRU.delete(key);
    return undefined;
  }
  // refresh recency
  cidLRU.delete(key);
  cidLRU.set(key, hit);
  return hit.value;
}
function lruSet(key: string, value: IpfsMessageJSON | null) {
  if (cidLRU.size >= CID_LRU_MAX) {
    const first = cidLRU.keys().next().value;
    if (first) cidLRU.delete(first);
  }
  cidLRU.set(key, { value, expiresAt: Date.now() + CID_TTL_MS });
}

async function fetchIpfsJson(cid: string): Promise<IpfsMessageJSON | null> {
  const cached = lruGet(cid);
  if (cached !== undefined) return cached;

  const path = normalizeCidToPath(cid);
  for (const base of IPFS_GATEWAYS) {
    const url = toGatewayUrl(path, base);
    try {
      const r = await fetchWithTimeout(url);
      if (!r.ok) continue;
      const data = (await r.json()) as IpfsMessageJSON;
      lruSet(cid, data);
      return data;
    } catch {
      // try next gateway
    }
  }
  lruSet(cid, null);
  return null;
}

function firstMediaUrlFromJson(json: IpfsMessageJSON | null): string | null {
  const src = json?.media?.[0]?.src;
  if (!src) return null;
  return toGatewayUrl(src, PREFERRED_GATEWAY);
}

/* Concurrency-limited map */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const ret: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (true) {
        const i = idx++;
        if (i >= items.length) break;
        ret[i] = await mapper(items[i], i);
      }
    });
  await Promise.all(workers);
  return ret;
}

function asEthFloat(weiStr: string): number {
  const bi = BigInt(weiStr);
  return Number((bi / BigInt(1e14)).toString()) / 1e4;
}

/* -------- Lite shaping: hydrate only what’s needed for first render -------- */

type GraphMsgLite = {
  uuid: string;
  author: string;
  cid: string;
  praiseCount: number;
  timestamp: string;
};
type GraphCreationLite = Omit<SubgraphCreation, "messages"> & {
  abrahamLatest: GraphMsgLite[];
  tail: GraphMsgLite[]; // DESC order
};

/**
 * Build a minimal CreationItem for first load:
 *  - Hydrate latest Abraham JSON (image/description)
 *  - Find blessings attached to it (contiguous non-owner msgs after it)
 *  - Hydrate only those blessings (content)
 *  - Return messages array containing [latestAbraham, ...attachedBlessings]
 */
async function shapeLite(c: GraphCreationLite): Promise<CreationItem> {
  const latest = c.abrahamLatest?.[0];
  if (!latest) {
    // Fallback (shouldn't happen, sessions start with an owner msg)
    return {
      id: c.id,
      closed: c.closed,
      image: "",
      description: "(no description)",
      praiseCount: 0,
      messageUuid: "",
      ethTotal: asEthFloat(c.ethSpent),
      blessingCnt: 0,
      blessings: [],
      messages: [],
      firstMessageAt: c.firstMessageAt,
      lastActivityAt: c.lastActivityAt,
    };
  }

  // Tail is DESC; flip to ASC for scanning
  const tailAsc = [...(c.tail || [])].reverse();

  // Ensure latest Abraham is included (it might be older than TAIL_FIRST_LOAD)
  // If not in tail, we still include it explicitly.
  const idxLatestInTail = tailAsc.findIndex((m) => m.uuid === latest.uuid);
  const blessingsForLatest: GraphMsgLite[] = [];
  if (idxLatestInTail !== -1) {
    for (let i = idxLatestInTail + 1; i < tailAsc.length; i++) {
      const m = tailAsc[i];
      const isOwner = m.author.toLowerCase() === OWNER;
      if (isOwner) break; // next Abraham update starts
      blessingsForLatest.push(m);
    }
  }

  // Hydrate just latest Abraham + its attached blessings
  const hydrateCids = [latest, ...blessingsForLatest].map((m) => m.cid);
  const dedupCids = Array.from(new Set(hydrateCids));
  await mapConcurrent(dedupCids, 24, (cid) => fetchIpfsJson(cid));

  const latestJson = await fetchIpfsJson(latest.cid);
  const heroImage = firstMediaUrlFromJson(latestJson) ?? "";
  const heroDescription = latestJson?.content ?? "(no description)";

  const messages: SubgraphMessage[] = [
    {
      uuid: latest.uuid,
      author: latest.author,
      content: heroDescription,
      media: heroImage,
      praiseCount: latest.praiseCount,
      timestamp: latest.timestamp,
    },
    ...(await mapConcurrent(blessingsForLatest, 24, async (m) => {
      const json = await fetchIpfsJson(m.cid);
      return {
        uuid: m.uuid,
        author: m.author,
        content: json?.content ?? "",
        media: null,
        praiseCount: m.praiseCount,
        timestamp: m.timestamp,
      } as SubgraphMessage;
    })),
  ];

  const blessings: Blessing[] = messages.slice(1).map((m) => ({
    author: m.author,
    content: m.content,
    praiseCount: m.praiseCount,
    timestamp: m.timestamp,
    creationId: c.id,
    messageUuid: m.uuid,
  }));

  return {
    id: c.id,
    closed: c.closed,
    image: heroImage,
    description: heroDescription,
    praiseCount: latest.praiseCount,
    messageUuid: latest.uuid,
    ethTotal: asEthFloat(c.ethSpent),
    blessingCnt: blessings.length,
    blessings,
    messages,
    firstMessageAt: c.firstMessageAt,
    lastActivityAt: c.lastActivityAt,
  };
}

/* -------- Full shaping (unchanged behaviour) -------- */

type GraphMsgFull = {
  uuid: string;
  author: string;
  cid: string;
  praiseCount: number;
  timestamp: string;
};
type GraphCreationFull = Omit<SubgraphCreation, "messages"> & {
  messages: GraphMsgFull[];
  abrahamLatest: GraphMsgFull[];
};

async function shapeFull(c: GraphCreationFull): Promise<CreationItem> {
  // Dedup CIDs & hydrate
  const allCids = Array.from(new Set(c.messages.map((m) => m.cid)));
  await mapConcurrent(allCids, 32, (cid) => fetchIpfsJson(cid));

  const messages: SubgraphMessage[] = await mapConcurrent(
    c.messages,
    32,
    async (m) => {
      const json = await fetchIpfsJson(m.cid);
      return {
        uuid: m.uuid,
        author: m.author,
        content: json?.content ?? "",
        media: firstMediaUrlFromJson(json),
        praiseCount: m.praiseCount,
        timestamp: m.timestamp,
      };
    }
  );

  const latestId = c.abrahamLatest?.[0]?.uuid;
  const latest =
    (latestId && messages.find((m) => m.uuid === latestId)) ||
    [...messages].reverse().find((m) => m.author.toLowerCase() === OWNER);

  const blessings: Blessing[] = messages
    .filter((m) => m.author.toLowerCase() !== OWNER)
    .map((m) => ({
      author: m.author,
      content: m.content,
      praiseCount: m.praiseCount,
      timestamp: m.timestamp,
      creationId: c.id,
      messageUuid: m.uuid,
    }));

  return {
    id: c.id,
    closed: c.closed,
    image: latest?.media ?? "",
    description: latest?.content ?? "(no description)",
    praiseCount: latest?.praiseCount ?? 0,
    messageUuid: latest?.uuid ?? "",
    ethTotal: asEthFloat(c.ethSpent),
    blessingCnt: blessings.length,
    blessings,
    messages,
    firstMessageAt: c.firstMessageAt,
    lastActivityAt: c.lastActivityAt,
  };
}

/* -------- Route -------- */

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("creationId");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const mode = (req.nextUrl.searchParams.get("mode") || "lite").toLowerCase();

  try {
    if (!OWNER) {
      throw new Error(
        "Missing NEXT_PUBLIC_OWNER_ADDRESS env var (required for subgraph query filtering)."
      );
    }

    if (mode === "full") {
      // Full (hydrated) detail — heavier
      const { data, errors } = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: DETAIL_QUERY_FULL,
          variables: { id, msgLimit: 5000, owner: OWNER },
        }),
        next: { revalidate: 0 },
      }).then((r) => r.json());

      if (errors) throw new Error(errors.map((e: any) => e.message).join(","));
      if (!data?.creation)
        return NextResponse.json({ error: "not found" }, { status: 404 });

      const creation = await shapeFull(data.creation as GraphCreationFull);
      return NextResponse.json(creation, { status: 200 });
    }

    // Lite (default) — super fast for first render
    const { data, errors } = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: DETAIL_QUERY_LITE,
        variables: { id, tail: TAIL_FIRST_LOAD, owner: OWNER },
      }),
      next: { revalidate: 0 },
    }).then((r) => r.json());

    if (errors) throw new Error(errors.map((e: any) => e.message).join(","));
    if (!data?.creation)
      return NextResponse.json({ error: "not found" }, { status: 404 });

    const creation = await shapeLite(data.creation as GraphCreationLite);
    return NextResponse.json(creation, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || String(e) },
      { status: 500 }
    );
  }
}
