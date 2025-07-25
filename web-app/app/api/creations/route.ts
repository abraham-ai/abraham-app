import { NextRequest, NextResponse } from "next/server";
import {
  CreationItem,
  SubgraphCreation,
  SubgraphMessage,
} from "@/types/abraham";

const ENDPOINT =
  "https://api.studio.thegraph.com/query/102152/abraham/version/latest";

/* note: no more numeric index; order by blockchain timestamp */
const LIST_QUERY = /* GraphQL */ `
  query AllCreations($first: Int!, $msgLimit: Int!) {
    creations(first: $first, orderBy: lastActivityAt, orderDirection: desc) {
      id
      ethSpent
      firstMessageAt
      lastActivityAt
      messages(orderBy: timestamp, orderDirection: asc, first: $msgLimit) {
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

export async function GET(_req: NextRequest) {
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: LIST_QUERY,
        variables: { first: 100, msgLimit: 200 },
      }),
      next: { revalidate: 0 },
    });
    const { data, errors } = await r.json();
    if (errors) throw new Error(errors.map((e: any) => e.message).join(", "));

    const creations: CreationItem[] = (
      data.creations as SubgraphCreation[]
    ).map((c) => {
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

      const latest = abrahamMsgs[abrahamMsgs.length - 1] as
        | SubgraphMessage
        | undefined;

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
      };
    });

    return NextResponse.json({ creations }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
