import { NextRequest, NextResponse } from "next/server";
import {
  CreationItem,
  SubgraphCreation,
  SubgraphMessage,
} from "@/types/abraham";

const ENDPOINT =
  "https://api.studio.thegraph.com/query/102152/abraham/version/latest";

/* 100 records / round-trip keeps latency reasonable. */
const GRAPH_PAGE_SIZE = 100;
const MSG_LIMIT = 100; // enough to compute total praises + last image
const PRAISE_SORT_LIMIT = 1_000; // safety cap: fetch at most 1 000 creations

const LIST_QUERY = `
  query AllCreations($first: Int!, $skip: Int!, $msgLimit: Int!) {
    creations(
      first: $first
      skip: $skip
      orderBy: lastActivityAt
      orderDirection: desc
    ) {
      id
      ethSpent
      firstMessageAt
      lastActivityAt
      messages(
        first: $msgLimit
        orderBy: timestamp
        orderDirection: asc
      ) {
        uuid
        author
        content
        media
        praiseCount
        timestamp
      }
    }
  }
`;

export const revalidate = 0;
const OWNER = process.env.NEXT_PUBLIC_OWNER_ADDRESS!.toLowerCase();

/* ───────────────────────────────────── helpers */
function shapeCreations(
  raw: SubgraphCreation[]
): (CreationItem & { totalPraises: number })[] {
  return raw.map((c) => {
    const abrahamMsgs = c.messages.filter(
      (m) => m.author.toLowerCase() === OWNER
    );
    const blessingsRaw = c.messages
      .filter((m) => m.author.toLowerCase() !== OWNER)
      .map((m) => ({
        author: m.author,
        content: m.content,
        praiseCount: m.praiseCount,
        timestamp: m.timestamp,
        messageUuid: m.uuid,
        creationId: c.id,
      }));

    const latest = abrahamMsgs.at(-1) as SubgraphMessage | undefined;
    const totalPraises = c.messages.reduce(
      (sum, msg) => sum + msg.praiseCount,
      0
    );

    return {
      id: c.id,
      image:
        latest?.media?.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/") ?? "",
      description: latest?.content ?? "(no description)",
      praiseCount: latest?.praiseCount ?? 0,
      messageUuid: latest?.uuid ?? "",

      ethTotal: Number((BigInt(c.ethSpent) / BigInt(1e14)).toString()) / 1e4,
      blessingCnt: blessingsRaw.length,

      firstMessageAt: c.firstMessageAt,
      lastActivityAt: c.lastActivityAt,

      blessings: blessingsRaw,
      messages: c.messages,

      totalPraises,
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") ?? "latest"; // 'latest' | 'most-praised'
    const first = Math.min(
      parseInt(url.searchParams.get("first") ?? "18", 10),
      100
    );
    const skip = parseInt(url.searchParams.get("skip") ?? "0", 10);

    if (sort !== "most-praised") {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: LIST_QUERY,
          variables: { first, skip, msgLimit: MSG_LIMIT },
        }),
        next: { revalidate: 0 },
      });

      const { data, errors } = await r.json();
      if (errors) throw new Error(errors.map((e: any) => e.message).join(", "));
      const creations = shapeCreations(data.creations).map(
        ({ totalPraises, ...c }) => c
      ); // drop helper prop
      return NextResponse.json({ creations }, { status: 200 });
    }

    /* ---------- SLOW PATH: sort = most-praised ---------- */
    /* We must pull enough creations to sort *globally* by praise total. */
    const needed = skip + first;
    let graphSkip = 0;
    const acc: SubgraphCreation[] = [];

    /* Keep fetching until we have ≥ needed OR we hit cap / run out */
    while (acc.length < needed && acc.length < PRAISE_SORT_LIMIT) {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: LIST_QUERY,
          variables: {
            first: GRAPH_PAGE_SIZE,
            skip: graphSkip,
            msgLimit: MSG_LIMIT,
          },
        }),
        next: { revalidate: 0 },
      });

      const { data, errors } = await r.json();
      if (errors) throw new Error(errors.map((e: any) => e.message).join(", "));
      const batch: SubgraphCreation[] = data.creations;
      if (batch.length === 0) break; // no more rows

      acc.push(...batch);
      graphSkip += GRAPH_PAGE_SIZE;
    }

    /* Shape + global sort */
    const shaped = shapeCreations(acc);
    shaped.sort((a, b) => b.totalPraises - a.totalPraises);

    /* Slice to the requested page, strip helper prop */
    const page = shaped
      .slice(skip, skip + first)
      .map(({ totalPraises, ...c }) => c);

    return NextResponse.json({ creations: page }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
