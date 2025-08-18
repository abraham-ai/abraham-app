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

// For first load: short tail
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

/* -------- Lite shaping: include ALL owner msgs in tail; attach blessings to latest -------- */
type GraphMsgLite = {
  uuid: string;
  author: string;
  cid: string;
  praiseCount: number;
  timestamp: string;
};
type GraphCreationLite = Omit<SubgraphCreation, "messages"> & {
  abrahamLatest: GraphMsgLite[];
  tail: GraphMsgLite[]; // DESC
};

async function shapeLite(c: GraphCreationLite): Promise<CreationItem> {
  const latest = c.abrahamLatest?.[0] || null;

  // Tail to ASC for scanning
  const tailAsc = [...(c.tail || [])].reverse();

  // Owner msgs in tail (ASC). Ensure latest is included even if older than tail
  const ownerInTail = tailAsc.filter((m) => m.author.toLowerCase() === OWNER);
  const ownerAll: GraphMsgLite[] = (() => {
    const list =
      latest && !ownerInTail.some((o) => o.uuid === latest.uuid)
        ? [...ownerInTail, latest]
        : ownerInTail;
    // sort ascending by timestamp (as strings)
    return [...list].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  })();

  // Blessings attached to the latest owner (contiguous non-owner after it)
  const blessingsForLatest: GraphMsgLite[] = [];
  if (latest) {
    // find idx of latest among ASC union: prefer tailAsc index
    const idxLatest =
      tailAsc.findIndex((m) => m.uuid === latest.uuid) !== -1
        ? tailAsc.findIndex((m) => m.uuid === latest.uuid)
        : -1;

    if (idxLatest !== -1) {
      for (let i = idxLatest + 1; i < tailAsc.length; i++) {
        const m = tailAsc[i];
        if (m.author.toLowerCase() === OWNER) break;
        blessingsForLatest.push(m);
      }
    }
  }

  // Hydrate: all owner messages in tail + latest (if added),
  // and blessings attached to latest only
  const hydrateCids = [
    ...ownerAll.map((m) => m.cid),
    ...blessingsForLatest.map((m) => m.cid),
  ];
  const dedup = Array.from(new Set(hydrateCids));
  await mapConcurrent(dedup, 24, (cid) => fetchIpfsJson(cid));

  // Hero image = most recent owner message **with media** (fall back to latest content)
  let heroImage = "";
  let heroDescription = "(no description)";
  let heroPraise = latest?.praiseCount ?? 0;
  let heroUuid = latest?.uuid ?? "";

  const ownerDesc = [...ownerAll].sort(
    (a, b) => Number(b.timestamp) - Number(a.timestamp)
  );
  for (const m of ownerDesc) {
    const json = await fetchIpfsJson(m.cid);
    const media = firstMediaUrlFromJson(json);
    if (media) {
      heroImage = media;
      heroDescription = json?.content ?? "(no description)";
      heroPraise = m.praiseCount;
      heroUuid = m.uuid;
      break;
    }
    if (m.uuid === latest?.uuid && json?.content) {
      heroDescription = json.content;
    }
  }

  // Build messages for first paint:
  // - All owner messages (hydrated)
  // - Plus attached blessings for latest owner only (hydrated)
  const ownerMessagesHydrated: SubgraphMessage[] = await mapConcurrent(
    ownerAll,
    24,
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

  const latestBlessingsHydrated: SubgraphMessage[] = await mapConcurrent(
    blessingsForLatest,
    24,
    async (m) => {
      const json = await fetchIpfsJson(m.cid);
      return {
        uuid: m.uuid,
        author: m.author,
        content: json?.content ?? "",
        media: null,
        praiseCount: m.praiseCount,
        timestamp: m.timestamp,
      };
    }
  );

  // Interleave: put latest blessings right after the latest owner msg
  let messages: SubgraphMessage[] = [];
  if (latest) {
    for (const m of ownerMessagesHydrated) {
      messages.push(m);
      if (m.uuid === latest.uuid) {
        messages.push(...latestBlessingsHydrated);
      }
    }
  } else {
    messages = ownerMessagesHydrated;
  }

  const blessings: Blessing[] = latestBlessingsHydrated.map((m) => ({
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
    praiseCount: heroPraise,
    messageUuid: heroUuid,
    ethTotal: asEthFloat(c.ethSpent),
    blessingCnt: blessings.length,
    blessings,
    messages,
    firstMessageAt: c.firstMessageAt,
    lastActivityAt: c.lastActivityAt,
  };
}

/* -------- Full shaping (unchanged) -------- */
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

  // Hero = most recent owner WITH media (fallback to latest content)
  const ownerDesc = [...messages]
    .filter((m) => m.author.toLowerCase() === OWNER)
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

  let heroImage = latest?.media ?? "";
  let heroDescription = latest?.content ?? "(no description)";
  let heroPraise = latest?.praiseCount ?? 0;
  let heroUuid = latest?.uuid ?? "";

  for (const m of ownerDesc) {
    if (m.media) {
      heroImage = m.media;
      heroDescription = m.content;
      heroPraise = m.praiseCount;
      heroUuid = m.uuid;
      break;
    }
  }

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
    image: heroImage,
    description: heroDescription,
    praiseCount: heroPraise,
    messageUuid: heroUuid,
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

    // LITE
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
