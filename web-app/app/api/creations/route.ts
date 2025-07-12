import { NextRequest, NextResponse } from "next/server";
import {
  CreationItem,
  Blessing,
  SubgraphCreation,
  SubgraphMessage,
} from "@/types/abraham";

/* Graph endpoint */
const ENDPOINT =
  "https://api.studio.thegraph.com/query/102152/abraham/version/latest";

/* Query all creations + all messages */
const LIST_QUERY = /* GraphQL */ `
  query AllCreations($first: Int!, $msgLimit: Int!) {
    creations(first: $first, orderBy: id, orderDirection: desc) {
      id
      messageCount
      ethSpent
      messages(orderBy: index, orderDirection: asc, first: $msgLimit) {
        index
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

export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: LIST_QUERY,
        variables: { first: 100, msgLimit: 200 },
      }),
    });
    const { data, errors } = await res.json();
    if (errors) throw new Error(errors.map((e: any) => e.message).join(","));

    const creations: CreationItem[] = (
      data.creations as SubgraphCreation[]
    ).map((c) => {
      /* split Abraham vs blessings */
      const abrahamMsgs = c.messages.filter(
        (m) => m.author.toLowerCase() === OWNER
      );
      const blessingsRaw = c.messages.filter(
        (m) => m.author.toLowerCase() !== OWNER
      );

      const latest = abrahamMsgs[abrahamMsgs.length - 1] as
        | SubgraphMessage
        | undefined;

      return {
        id: c.id,
        image:
          latest?.media?.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/") ?? "",
        description: latest?.content ?? "(no description)",
        praiseCount: latest?.praiseCount ?? 0,
        messageIndex: latest?.index ?? 0,
        ethTotal: Number((BigInt(c.ethSpent) / BigInt(1e14)).toString()) / 1e4,
        blessingCnt: blessingsRaw.length,
        blessings: blessingsRaw as Blessing[],
        messages: c.messages,
      };
    });

    return NextResponse.json({ creations }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
