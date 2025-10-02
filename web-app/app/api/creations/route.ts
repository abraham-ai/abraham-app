import { NextRequest, NextResponse } from "next/server";
import {
  CreationItem,
  SubgraphCreation,
  SubgraphMessage,
  Blessing,
} from "@/types/abraham";

/* ───────── Graph endpoint ───────── */
const ENDPOINT =
  "https://api.studio.thegraph.com/query/102152/abraham/version/latest";

/* paging & limits */
const GRAPH_PAGE_SIZE = 500;
const PRAISE_SORT_LIMIT = 2_000; // safety cap for most-praised scan

// Short tail so feed can compute attached blessings fast
const MSG_TAIL = 32;

export const revalidate = 0;

/* Owner (Abraham) lowercased for comparisons) */
const OWNER = (process.env.NEXT_PUBLIC_OWNER_ADDRESS || "").toLowerCase();

/* Preferred gateway (optional) */
const PREFERRED_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://cloudflare-ipfs.com/ipfs/";

/* Gateways fallback chain (fastest first) */
const IPFS_GATEWAYS = [
  PREFERRED_GATEWAY,
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

/* ------------- GraphQL ------------- */
/**
 * We fetch:
 * - `abrahamLatest`: newest owner message (has CID)
 * - `messagesTail`: short tail (DESC) with **cid** so we can hydrate owner candidates
 */
const LIST_QUERY = /* GraphQL */ `
  query AllCreations(
    $first: Int!
    $skip: Int!
    $msgTail: Int!
    $owner: Bytes!
  ) {
    creations(
      first: $first
      skip: $skip
      orderBy: lastActivityAt
      orderDirection: desc
    ) {
      id
      sessionIdRaw
      closed
      linkedTotal
      totalBlessings
      totalPraises
      firstMessageAt
      lastActivityAt
      messageCount
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
      messagesTail: messages(
        first: $msgTail
        orderBy: timestamp
        orderDirection: desc
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

/* ------------- IPFS helpers ------------- */

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

function toGatewayUrl(cidOrSrc: string, gatewayBase: string): string {
  if (/^https?:\/\//i.test(cidOrSrc)) return cidOrSrc;
  const base = gatewayBase.endsWith("/") ? gatewayBase : gatewayBase + "/";
  return base + normalizeCidToPath(cidOrSrc);
}

async function fetchWithTimeout(url: string, ms = 7000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 },
      headers: { Accept: "application/json" },
    });
  } finally {
    clearTimeout(id);
  }
}

/* ─── LRU + TTL (process-wide) for hydrated IPFS JSON ─── */
type CacheEntry = { value: IpfsMessageJSON | null; expiresAt: number };
const CID_LRU_MAX = 3000;
const CID_TTL_MS = 1000 * 60 * 60 * 12; // 12h
const cidLRU: Map<string, CacheEntry> =
  (global as any).__ipfs_json_lru__ || new Map();
(global as any).__ipfs_json_lru__ = cidLRU;

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
    // evict oldest
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

function firstMediaUrlFromJson(json: IpfsMessageJSON | null): string | null {
  const src = json?.media?.[0]?.src;
  if (!src) return null;
  return toGatewayUrl(src, PREFERRED_GATEWAY);
}

/* ───────────── shapers ───────────── */

type GraphMsgLatest = {
  uuid: string;
  author: string;
  cid: string;
  praiseCount: number;
  timestamp: string;
};
type GraphMsgTail = {
  uuid: string;
  author: string;
  cid: string;
  praiseCount: number;
  timestamp: string;
};
type GraphCreation = Omit<SubgraphCreation, "messages"> & {
  messageCount: number;
  abrahamLatest: GraphMsgLatest[];
  messagesTail: GraphMsgTail[];
};

function asTokenFloat(weiStr: string): number {
  const bi = BigInt(weiStr);
  return Number((bi / BigInt(1e14)).toString()) / 1e4;
}

/**
 * Shapes raw creations:
 * - Hydrate **candidate owner messages** (latest + owner msgs in tail) until we find the
 *   most recent one **with media** → hero image/description.
 * - Keep tail for UI blessing math (no extra hydration for non-owners).
 */
async function shapeCreationsList(
  raws: GraphCreation[]
): Promise<(CreationItem & { tailPraiseSum: number })[]> {
  return Promise.all(
    raws.map(async (c) => {
      const latestOwner = c.abrahamLatest?.[0] || null;

      // Owner candidates = latest + any owner msgs found in tail (DESC → keep timestamp ordering)
      const ownerCandidatesDesc = [
        ...(latestOwner ? [latestOwner] : []),
        ...c.messagesTail.filter((m) => m.author.toLowerCase() === OWNER),
      ];

      // Dedup by uuid, keep descending order (most recent first)
      const seen = new Set<string>();
      const ownerCandidates = ownerCandidatesDesc.filter((m) => {
        if (seen.has(m.uuid)) return false;
        seen.add(m.uuid);
        return true;
      });

      // Hydrate up to 6 candidates, stop at the first that has media
      let heroImage = "";
      let heroDescription = "(no description)";
      let heroPraise = latestOwner?.praiseCount ?? 0;
      let heroUuid = latestOwner?.uuid ?? "";

      const maxToHydrate = Math.min(ownerCandidates.length, 6);
      for (let i = 0; i < maxToHydrate; i++) {
        const m = ownerCandidates[i]!;
        const json = await fetchIpfsJson(m.cid);
        const mediaUrl = firstMediaUrlFromJson(json);
        // set hero to FIRST candidate with media; if none have media, fall back to latestOwner's content
        if (mediaUrl) {
          heroImage = mediaUrl;
          heroDescription = json?.content ?? "(no description)";
          heroPraise = m.praiseCount;
          heroUuid = m.uuid;
          break;
        }
        // if first candidate is the true latest and has only text, keep its text as description
        if (i === 0 && json?.content) {
          heroDescription = json.content;
        }
      }

      // Tail is DESC; reverse to ASC for UI logic
      const tailAsc = [...c.messagesTail].reverse();

      const blessings: Blessing[] = tailAsc
        .filter((m) => m.author.toLowerCase() !== OWNER)
        .map((m) => ({
          author: m.author,
          content: "", // placeholder
          praiseCount: m.praiseCount,
          timestamp: m.timestamp,
          messageUuid: m.uuid,
          creationId: c.id,
          sessionIdRaw: c.sessionIdRaw,
        }));

      const messages: SubgraphMessage[] = tailAsc.map((m) => ({
        uuid: m.uuid,
        author: m.author,
        content: "",
        media: null,
        praiseCount: m.praiseCount,
        timestamp: m.timestamp,
      }));

      const tailPraiseSum = tailAsc.reduce((sum, m) => sum + m.praiseCount, 0);

      return {
        id: c.id,
        sessionIdRaw: c.sessionIdRaw,
        closed: c.closed,
        image: heroImage, // ← most recent owner msg with media
        description: heroDescription,
        praiseCount: heroPraise,
        messageUuid: heroUuid,
        linkedTotal: asTokenFloat(c.linkedTotal),
        totalBlessings: c.totalBlessings,
        totalPraises: c.totalPraises,
        blessingCnt: blessings.length,
        firstMessageAt: c.firstMessageAt,
        lastActivityAt: c.lastActivityAt,
        blessings,
        messages,
        tailPraiseSum,
      };
    })
  );
}

/* ───────────── route ───────────── */

export async function GET(req: NextRequest) {
  try {
    if (!OWNER) {
      throw new Error(
        "Missing NEXT_PUBLIC_OWNER_ADDRESS env var (required for subgraph query filtering)."
      );
    }

    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") ?? "latest"; // 'latest' | 'most-praised'
    const first = Math.min(
      parseInt(url.searchParams.get("first") ?? "18", 10),
      100
    );
    const skip = parseInt(url.searchParams.get("skip") ?? "0", 10);

    /* ------ FAST PATH: latest / default ordering ------ */
    if (sort !== "most-praised") {
      const { data, errors } = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: LIST_QUERY,
          variables: { first, skip, msgTail: MSG_TAIL, owner: OWNER },
        }),
        next: { revalidate: 0 },
      }).then((r) => r.json());

      if (errors) throw new Error(errors.map((e: any) => e.message).join(", "));

      const shaped = await shapeCreationsList(
        data.creations as GraphCreation[]
      );
      const creations: CreationItem[] = shaped.map(
        ({ tailPraiseSum, ...rest }) => rest as CreationItem
      );

      return NextResponse.json({ creations }, { status: 200 });
    }

    /* ------ SLOWER PATH: global most-praised ordering (parallel pages) ------ */
    const neededRows = skip + first;

    const pages: number[] = [];
    for (let i = 0; i < Math.ceil(neededRows / GRAPH_PAGE_SIZE); i++) {
      pages.push(i);
    }
    if (pages.length === 0) pages.push(0);

    const parallelFetch = async (pageIdx: number) => {
      const graphSkip = pageIdx * GRAPH_PAGE_SIZE;
      const { data, errors } = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: LIST_QUERY,
          variables: {
            first: GRAPH_PAGE_SIZE,
            skip: graphSkip,
            msgTail: MSG_TAIL,
            owner: OWNER,
          },
        }),
        next: { revalidate: 0 },
      }).then((r) => r.json());
      if (errors) throw new Error(errors.map((e: any) => e.message).join(", "));
      return (data.creations || []) as GraphCreation[];
    };

    const firstBatch = await Promise.all(pages.map((p) => parallelFetch(p)));
    const acc = firstBatch.flat();

    let page = pages.length;
    while (acc.length < neededRows && acc.length < PRAISE_SORT_LIMIT) {
      const more = await parallelFetch(page++);
      if (!more.length) break;
      acc.push(...more);
    }

    const shaped = await shapeCreationsList(acc);
    shaped.sort((a, b) => b.tailPraiseSum - a.tailPraiseSum);

    const pageOut: CreationItem[] = shaped
      .slice(skip, skip + first)
      .map(({ tailPraiseSum, ...rest }) => rest as CreationItem);

    return NextResponse.json({ creations: pageOut }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || String(e) },
      { status: 500 }
    );
  }
}
