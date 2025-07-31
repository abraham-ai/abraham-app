import { NextRequest, NextResponse } from "next/server";
import { SubgraphCreation, CreationItem } from "@/types/abraham";

const ENDPOINT =
  "https://api.studio.thegraph.com/query/102152/abraham/version/latest";

const DETAIL_QUERY = /* GraphQL */ `
  query One($id: ID!, $msgLimit: Int!) {
    creation(id: $id) {
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

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("creationId");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  try {
    const { data, errors } = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: DETAIL_QUERY,
        variables: { id, msgLimit: 1000 },
      }),
      next: { revalidate: 0 },
    }).then((r) => r.json());

    if (errors) throw new Error(errors.map((e: any) => e.message).join(","));
    if (!data.creation)
      return NextResponse.json({ error: "not found" }, { status: 404 });

    const c: SubgraphCreation = data.creation;
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

    const latest = abrahamMsgs.at(-1);

    const creation: CreationItem = {
      id: c.id,
      closed: c.closed,
      image:
        latest?.media?.replace(
          /^ipfs:\/\//,
          "https://gateway.pinata.cloud/ipfs/"
        ) ?? "",
      description: latest?.content ?? "(no description)",
      praiseCount: latest?.praiseCount ?? 0,
      messageUuid: latest?.uuid ?? "",
      ethTotal: Number((BigInt(c.ethSpent) / BigInt(1e14)).toString()) / 1e4,
      blessingCnt: blessingsRaw.length,
      blessings: blessingsRaw,
      messages: c.messages,
      firstMessageAt: c.firstMessageAt,
      lastActivityAt: c.lastActivityAt,
    };

    return NextResponse.json(creation, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
