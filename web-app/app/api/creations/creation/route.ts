import { NextRequest, NextResponse } from "next/server";
import {
  SubgraphCreation,
  CreationItem,
  SubgraphMessage,
  Blessing,
} from "@/types/abraham";
import {
  fetchIpfsJson,
  firstResolvedMediaUrlFromJson,
  IpfsMessageJSON,
} from "@/lib/ipfs";

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

// Keep tail small for speed; hydrate all messages within it
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
      # newest Abraham message (for fallback + hero selection)
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
      # short recent tail (DESC) with cid so we can hydrate all items in the tail
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

/* -------- Lite shaping: hydrate the ENTIRE tail (owners + blessings) -------- */
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
  const latestOwner = c.abrahamLatest?.[0] || null;

  // Tail to ASC for timeline grouping
  const tailAsc = [...(c.tail || [])].reverse();

  // If the latest owner is outside the tail (rare), include it explicitly
  const hasLatestInTail =
    !!latestOwner && tailAsc.some((m) => m.uuid === latestOwner.uuid);
  const unionAsc: GraphMsgLite[] = hasLatestInTail
    ? tailAsc
    : latestOwner
    ? [...tailAsc, latestOwner].sort(
        (a, b) => Number(a.timestamp) - Number(b.timestamp)
      )
    : tailAsc;

  // Hydrate ALL messages in unionAsc (owners & blessings)
  const dedupCids = Array.from(new Set(unionAsc.map((m) => m.cid)));
  await mapConcurrent(dedupCids, 24, (cid) => fetchIpfsJson(cid));

  // Build hydrated messages in ASC order
  const hydratedAsc: SubgraphMessage[] = await mapConcurrent(
    unionAsc,
    24,
    async (m) => {
      const json = await fetchIpfsJson(m.cid, IPFS_GATEWAYS);
      const isOwner = m.author.toLowerCase() === OWNER;
      return {
        uuid: m.uuid,
        author: m.author,
        content: json?.content ?? "",
        media: isOwner
          ? await firstResolvedMediaUrlFromJson(json, IPFS_GATEWAYS)
          : null,
        praiseCount: m.praiseCount,
        timestamp: m.timestamp,
      };
    }
  );

  // Choose hero = most recent owner WITH media; fallback to latest owner's content
  const ownerDesc = [...hydratedAsc]
    .filter((m) => m.author.toLowerCase() === OWNER)
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

  // Start with latest (if present)
  let heroImage = latestOwner ? "" : "";
  let heroDescription = latestOwner ? "(no description)" : "(no description)";
  let heroPraise = latestOwner?.praiseCount ?? 0;
  let heroUuid = latestOwner?.uuid ?? "";

  // fallback to latest owner's hydrated content if found
  if (latestOwner) {
    const latestHydrated = hydratedAsc.find((m) => m.uuid === latestOwner.uuid);
    if (latestHydrated) {
      heroDescription = latestHydrated.content || "(no description)";
      heroImage = latestHydrated.media || "";
    }
  }

  for (const m of ownerDesc) {
    if (m.media) {
      heroImage = m.media;
      heroDescription = m.content;
      heroPraise = m.praiseCount;
      heroUuid = m.uuid;
      break;
    }
  }

  // Blessings array = all non-owner messages in hydrated tail
  const blessings: Blessing[] = hydratedAsc
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
    messages: hydratedAsc, // ← contains all owner + blessing messages (ASC) from the tail
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
      const json = await fetchIpfsJson(m.cid, IPFS_GATEWAYS);
      return {
        uuid: m.uuid,
        author: m.author,
        content: json?.content ?? "",
        media:
          m.author.toLowerCase() === OWNER
            ? await firstResolvedMediaUrlFromJson(json, IPFS_GATEWAYS)
            : null,
        praiseCount: m.praiseCount,
        timestamp: m.timestamp,
      };
    }
  );

  const ownerDesc = [...messages]
    .filter((m) => m.author.toLowerCase() === OWNER)
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

  const latest = ownerDesc[0];

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

    // LITE: hydrate entire tail (owners + blessings) so messages between Abraham updates are visible
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
