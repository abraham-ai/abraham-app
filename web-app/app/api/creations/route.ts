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
const MSG_LIMIT = 100; // messages fetched per creation
const PRAISE_SORT_LIMIT = 1_000; // safety cap for most-praised path

export const revalidate = 0;

/* Owner (Abraham) lowercased for comparisons) */
const OWNER = (process.env.NEXT_PUBLIC_OWNER_ADDRESS || "").toLowerCase();

/* Preferred gateway (optional) */
const PREFERRED_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/";

/* Gateways fallback chain */
const IPFS_GATEWAYS = [
  (base: string) => base, // preferred (already full base URL)
  () => "https://cloudflare-ipfs.com/ipfs/",
  () => "https://ipfs.io/ipfs/",
].map((fn) => fn(PREFERRED_GATEWAY));

/* ------------- GraphQL ------------- */
/**
 * Efficient list query:
 * 1) All messages (cid only) — cheap, for counts + metadata (no IPFS hits).
 * 2) Latest Abraham message per creation — 1 CID per creation to hydrate.
 */
const LIST_QUERY = /* GraphQL */ `
  query AllCreations(
    $first: Int!
    $skip: Int!
    $msgLimit: Int!
    $owner: Bytes!
  ) {
    creations(
      first: $first
      skip: $skip
      orderBy: lastActivityAt
      orderDirection: desc
    ) {
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
  // Accepts "ipfs://<cid>" or bare "<cid>" or already "bafy.."
  const clean = cid.replace(/^ipfs:\/\//i, "");
  // If user passed a full gateway URL already, just return the path segment
  const parts = clean.split("/"); // cid[/path]
  const root = parts[0];
  const rest = parts.slice(1).join("/");
  return rest ? `${root}/${rest}` : root;
}

function toGatewayUrl(cidOrSrc: string, gatewayBase: string): string {
  // If it's already an http(s) URL, just return it
  if (/^https?:\/\//i.test(cidOrSrc)) return cidOrSrc;

  // If it's an ipfs:// or bare cid path, rewrite
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

/* Concurrency-limited map to avoid hammering gateways */
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

/* Cache CID → hydrated JSON for duration of the invocation */
const cidCache = new Map<string, Promise<IpfsMessageJSON | null>>();

function hydrateCid(cid: string) {
  if (!cidCache.has(cid)) cidCache.set(cid, fetchIpfsJson(cid));
  return cidCache.get(cid)!;
}

/* Resolve media src to a gateway URL (first media item) */
function firstMediaUrlFromJson(json: IpfsMessageJSON | null): string | null {
  const src = json?.media?.[0]?.src;
  if (!src) return null;
  return toGatewayUrl(src, PREFERRED_GATEWAY);
}

/* Transform Graph message (cid) → SubgraphMessage (content/media hydrated or placeholders) */
async function toSubgraphMessageHydrated(
  m: {
    uuid: string;
    author: string;
    cid: string;
    praiseCount: number;
    timestamp: string;
  },
  hydrate: boolean
): Promise<SubgraphMessage> {
  if (!hydrate) {
    // placeholders for list view efficiency
    return {
      uuid: m.uuid,
      author: m.author,
      content: "",
      media: null,
      praiseCount: m.praiseCount,
      timestamp: m.timestamp,
    };
  }

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

/* ───────────── shapers ───────────── */

type GraphMsgCid = {
  uuid: string;
  author: string;
  cid: string;
  praiseCount: number;
  timestamp: string;
};

type GraphCreation = Omit<SubgraphCreation, "messages"> & {
  messages: GraphMsgCid[];
  abrahamLatest: GraphMsgCid[];
};

function asEthFloat(weiStr: string): number {
  // Keep your prior logic: show with 4 dp ETH
  const bi = BigInt(weiStr);
  // divide by 1e14 then /1e4 to keep float
  return Number((bi / BigInt(1e14)).toString()) / 1e4;
}

/**
 * Shapes raw creations to CreationItem, hydrating ONLY the latest Abraham message
 * for each creation (for image + description + top-level praiseCount/messageUuid).
 * Other messages are returned with placeholder content/media for efficiency.
 */
async function shapeCreationsList(
  raws: GraphCreation[]
): Promise<(CreationItem & { totalPraises: number })[]> {
  // Collect unique CIDs for the latest abraham messages per creation
  const latestPairs = raws.map((c) => ({
    creationId: c.id,
    latest: c.abrahamLatest?.[0] || null,
  }));

  // Hydrate latest only (1 per creation)
  await mapConcurrent(
    latestPairs,
    24,
    async ({ latest }) => latest && (await hydrateCid(latest.cid))
  );

  // Now shape per creation
  return Promise.all(
    raws.map(async (c) => {
      const latest = c.abrahamLatest?.[0];

      const latestJson = latest ? await hydrateCid(latest.cid) : null;
      const imageUrl = firstMediaUrlFromJson(latestJson) ?? "";
      const description = latestJson?.content ?? "(no description)";

      // Blessings (we will NOT hydrate content/media in list for efficiency)
      const blessingsRaw: Blessing[] = c.messages
        .filter((m) => m.author.toLowerCase() !== OWNER)
        .map((m) => ({
          author: m.author,
          content: "", // placeholder (we avoid list hydration)
          praiseCount: m.praiseCount,
          timestamp: m.timestamp,
          messageUuid: m.uuid,
          creationId: c.id,
        }));

      // Total praises across messages
      const totalPraises = c.messages.reduce(
        (sum, m) => sum + m.praiseCount,
        0
      );

      // Messages with placeholders (we avoid list hydration)
      const messages: SubgraphMessage[] = c.messages.map((m) => ({
        uuid: m.uuid,
        author: m.author,
        content: "", // placeholder
        media: null, // placeholder
        praiseCount: m.praiseCount,
        timestamp: m.timestamp,
      }));

      return {
        id: c.id,
        closed: c.closed,
        image: imageUrl,
        description,
        praiseCount: latest?.praiseCount ?? 0,
        messageUuid: latest?.uuid ?? "",
        ethTotal: asEthFloat(c.ethSpent),
        blessingCnt: blessingsRaw.length,
        firstMessageAt: c.firstMessageAt,
        lastActivityAt: c.lastActivityAt,
        blessings: blessingsRaw,
        messages,
        totalPraises,
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
          variables: { first, skip, msgLimit: MSG_LIMIT, owner: OWNER },
        }),
        next: { revalidate: 0 },
      }).then((r) => r.json());

      if (errors) throw new Error(errors.map((e: any) => e.message).join(", "));

      const shaped = await shapeCreationsList(
        data.creations as GraphCreation[]
      );
      const creations: CreationItem[] = shaped.map(
        ({ totalPraises, ...rest }) => rest as CreationItem
      );

      return NextResponse.json({ creations }, { status: 200 });
    }

    /* ------ SLOW PATH: global most-praised ordering ------ */
    const neededRows = skip + first;
    const acc: GraphCreation[] = [];
    let graphSkip = 0;

    while (acc.length < neededRows && acc.length < PRAISE_SORT_LIMIT) {
      const { data, errors } = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: LIST_QUERY,
          variables: {
            first: GRAPH_PAGE_SIZE,
            skip: graphSkip,
            msgLimit: MSG_LIMIT,
            owner: OWNER,
          },
        }),
        next: { revalidate: 0 },
      }).then((r) => r.json());

      if (errors) throw new Error(errors.map((e: any) => e.message).join(", "));

      const batch: GraphCreation[] = data.creations;
      if (!batch || batch.length === 0) break;

      acc.push(...batch);
      graphSkip += GRAPH_PAGE_SIZE;
    }

    /* shape + global sort */
    const shaped = await shapeCreationsList(acc);
    shaped.sort((a, b) => b.totalPraises - a.totalPraises);

    const page: CreationItem[] = shaped
      .slice(skip, skip + first)
      .map(({ totalPraises, ...rest }) => rest as CreationItem);

    return NextResponse.json({ creations: page }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || String(e) },
      { status: 500 }
    );
  }
}
