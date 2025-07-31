import { NextRequest, NextResponse } from "next/server";
import {
  CreationItem,
  SubgraphCreation,
  SubgraphMessage,
} from "@/types/abraham";

/* ───────── Graph endpoint ───────── */
const ENDPOINT =
  "https://api.studio.thegraph.com/query/102152/abraham/version/latest";

/* paging & limits */
const GRAPH_PAGE_SIZE = 100;
const MSG_LIMIT = 100; // messages fetched per creation
const PRAISE_SORT_LIMIT = 1_000; // safety cap for most-praised path

const LIST_QUERY = `
  query AllCreations($first: Int!, $skip: Int!, $msgLimit: Int!) {
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

/* ───────────── helper: turn subgraph rows → front-end shape ────────── */
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

    const latestAbraham = abrahamMsgs.at(-1) as SubgraphMessage | undefined;

    const totalPraises = c.messages.reduce(
      (sum, msg) => sum + msg.praiseCount,
      0
    );

    return {
      id: c.id,
      closed: c.closed,
      image:
        latestAbraham?.media?.replace(
          /^ipfs:\/\//,
          "https://gateway.pinata.cloud/ipfs/"
        ) ?? "",
      description: latestAbraham?.content ?? "(no description)",
      praiseCount: latestAbraham?.praiseCount ?? 0,
      messageUuid: latestAbraham?.uuid ?? "",
      ethTotal: Number((BigInt(c.ethSpent) / BigInt(1e14)).toString()) / 1e4,
      blessingCnt: blessingsRaw.length,
      firstMessageAt: c.firstMessageAt,
      lastActivityAt: c.lastActivityAt,
      blessings: blessingsRaw,
      messages: c.messages,
      /* helper ------------------------------------ */
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

    /* ------ FAST PATH: latest / default ordering ------ */
    if (sort !== "most-praised") {
      const { data, errors } = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: LIST_QUERY,
          variables: { first, skip, msgLimit: MSG_LIMIT },
        }),
        next: { revalidate: 0 },
      }).then((r) => r.json());

      if (errors) throw new Error(errors.map((e: any) => e.message).join(", "));

      const creations: CreationItem[] = shapeCreations(data.creations).map(
        ({ totalPraises, ...rest }) => rest as CreationItem
      );

      return NextResponse.json({ creations }, { status: 200 });
    }

    /* ------ SLOW PATH: global most-praised ordering ------ */
    const neededRows = skip + first;
    const acc: SubgraphCreation[] = [];
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
          },
        }),
        next: { revalidate: 0 },
      }).then((r) => r.json());

      if (errors) throw new Error(errors.map((e: any) => e.message).join(", "));

      const batch: SubgraphCreation[] = data.creations;
      if (batch.length === 0) break;

      acc.push(...batch);
      graphSkip += GRAPH_PAGE_SIZE;
    }

    /* shape + global sort */
    const shaped = shapeCreations(acc);
    shaped.sort((a, b) => b.totalPraises - a.totalPraises);

    const page: CreationItem[] = shaped
      .slice(skip, skip + first)
      .map(({ totalPraises, ...rest }) => rest as CreationItem);

    return NextResponse.json({ creations: page }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
