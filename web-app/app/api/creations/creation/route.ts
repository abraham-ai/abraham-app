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
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

const IPFS_GATEWAYS = [
  (base: string) => base,
  () => "https://cloudflare-ipfs.com/ipfs/",
  () => "https://ipfs.io/ipfs/",
].map((fn) => fn(PREFERRED_GATEWAY));

/* -------- GraphQL -------- */
const DETAIL_QUERY = /* GraphQL */ `
  query One($id: ID!, $msgLimit: Int!, $owner: Bytes!) {
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

/* -------- IPFS helpers (same as list route) -------- */
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
  const path = normalizeCidToPath(cidOrSrc);
  const base = gatewayBase.endsWith("/") ? gatewayBase : gatewayBase + "/";
  return `${base}${path}`;
}

async function fetchWithTimeout(url: string, ms = 7000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(id);
  }
}

async function fetchIpfsJson(cid: string): Promise<IpfsMessageJSON | null> {
  const path = normalizeCidToPath(cid);
  for (const base of IPFS_GATEWAYS) {
    const url = toGatewayUrl(path, base);
    try {
      const r = await fetchWithTimeout(url);
      if (!r.ok) continue;
      const data = (await r.json()) as IpfsMessageJSON;
      return data;
    } catch {
      // try next gateway
    }
  }
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

const cidCache = new Map<string, Promise<IpfsMessageJSON | null>>();
function hydrateCid(cid: string) {
  if (!cidCache.has(cid)) cidCache.set(cid, fetchIpfsJson(cid));
  return cidCache.get(cid)!;
}

function firstMediaUrlFromJson(json: IpfsMessageJSON | null): string | null {
  const src = json?.media?.[0]?.src;
  if (!src) return null;
  return toGatewayUrl(src, PREFERRED_GATEWAY);
}

/* -------- shaping -------- */
type GraphMsgCid = {
  uuid: string;
  author: string;
  cid: string;
  praiseCount: number;
  timestamp: string;
};
type GraphCreationDetail = Omit<SubgraphCreation, "messages"> & {
  messages: GraphMsgCid[];
  abrahamLatest: GraphMsgCid[];
};

function asEthFloat(weiStr: string): number {
  const bi = BigInt(weiStr);
  return Number((bi / BigInt(1e14)).toString()) / 1e4;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("creationId");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  try {
    if (!OWNER) {
      throw new Error(
        "Missing NEXT_PUBLIC_OWNER_ADDRESS env var (required for subgraph query filtering)."
      );
    }

    const { data, errors } = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: DETAIL_QUERY,
        variables: { id, msgLimit: 1000, owner: OWNER },
      }),
      next: { revalidate: 0 },
    }).then((r) => r.json());

    if (errors) throw new Error(errors.map((e: any) => e.message).join(","));
    if (!data?.creation)
      return NextResponse.json({ error: "not found" }, { status: 404 });

    const c: GraphCreationDetail = data.creation;

    // Dedup all CIDs and hydrate with concurrency limit
    const allCids = Array.from(
      new Set(c.messages.map((m) => m.cid).filter(Boolean))
    );
    await mapConcurrent(allCids, 24, async (cid) => await hydrateCid(cid));

    // Build full hydrated messages
    const messages: SubgraphMessage[] = await mapConcurrent(
      c.messages,
      24,
      async (m) => {
        const json = await hydrateCid(m.cid);
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

    // Split blessings vs owner
    const abrahamMsgs = messages.filter(
      (m) => m.author.toLowerCase() === OWNER
    );
    const blessingsRaw: Blessing[] = messages
      .filter((m) => m.author.toLowerCase() !== OWNER)
      .map((m) => ({
        author: m.author,
        content: m.content,
        praiseCount: m.praiseCount,
        timestamp: m.timestamp,
        messageUuid: m.uuid,
        creationId: c.id,
      }));

    // Latest abraham for hero image/desc
    const latest = c.abrahamLatest?.[0]
      ? messages.find((m) => m.uuid === c.abrahamLatest[0].uuid)
      : abrahamMsgs[abrahamMsgs.length - 1];

    const creation: CreationItem = {
      id: c.id,
      closed: c.closed,
      image: latest?.media ?? "",
      description: latest?.content ?? "(no description)",
      praiseCount: latest?.praiseCount ?? 0,
      messageUuid: latest?.uuid ?? "",
      ethTotal: asEthFloat(c.ethSpent),
      blessingCnt: blessingsRaw.length,
      blessings: blessingsRaw,
      messages,
      firstMessageAt: c.firstMessageAt,
      lastActivityAt: c.lastActivityAt,
    };

    return NextResponse.json(creation, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || String(e) },
      { status: 500 }
    );
  }
}
