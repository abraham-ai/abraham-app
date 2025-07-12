import { NextRequest, NextResponse } from "next/server";
import {
  SubgraphCreation,
  SubgraphMessage,
  CreationItem,
  Blessing,
} from "@/types/abraham";

const ENDPOINT =
  "https://api.studio.thegraph.com/query/102152/abraham/version/latest";

const DETAIL_QUERY = /* GraphQL */ `
  query One($id: ID!, $msgLimit: Int!) {
    creation(id: $id) {
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

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("creationId");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: DETAIL_QUERY,
        variables: { id, msgLimit: 1000 },
      }),
    });
    const { data, errors } = await res.json();
    if (errors) throw new Error(errors.map((e: any) => e.message).join(","));
    if (!data.creation)
      return NextResponse.json({ error: "not found" }, { status: 404 });

    const c: SubgraphCreation = data.creation;

    /* Split + locate latest Abraham message */
    const abrahamMsgs = c.messages.filter(
      (m) => m.author.toLowerCase() === OWNER
    );
    const blessingsRaw = c.messages.filter(
      (m) => m.author.toLowerCase() !== OWNER
    );
    const latest = abrahamMsgs[abrahamMsgs.length - 1];

    /* Creation summary used by <Creation> card */
    const creation: CreationItem = {
      id: c.id,
      image:
        latest?.media?.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/") ?? "",
      description: latest?.content ?? "(no description)",
      praiseCount: latest?.praiseCount ?? 0,
      messageIndex: latest?.index ?? 0,
      ethTotal: Number((BigInt(c.ethSpent) / BigInt(1e14)).toString()) / 1e4,
      blessingCnt: blessingsRaw.length,
      blessings: blessingsRaw as Blessing[],
      /* NEW → full chronological list */
      messages: c.messages,
    };

    return NextResponse.json(creation, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
