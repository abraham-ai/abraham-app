import { NextRequest, NextResponse } from "next/server";
import { CreationItem, SubgraphCreation } from "@/types/abraham";

const ENDPOINT =
  "https://api.studio.thegraph.com/query/102152/abraham/version/latest";

const DETAIL_QUERY = `
  query One($id:ID!){
    creation(id:$id){
      id
      abrahamMessageCount
      blessingCount
      ethSpentTotal
      abrahamMessages(orderBy:index,orderDirection:desc){
        index content media praiseCount
      }
      blessings{ author content praiseCount timestamp }
      praises{ praiser timestamp }
    }
  }`;

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.pathname.split("/").pop();
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: DETAIL_QUERY, variables: { id } }),
    });
    const { data, errors } = await res.json();
    if (errors) throw new Error(errors.map((e: any) => e.message).join(","));
    if (!data.creation)
      return NextResponse.json({ error: "not found" }, { status: 404 });

    const c: SubgraphCreation = data.creation;
    const msg = c.abrahamMessages[0];
    const item: CreationItem = {
      id: c.id,
      image: msg.media.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/"),
      description: msg.content,
      ethTotal:
        Number((BigInt(c.ethSpentTotal) / BigInt(1e14)).toString()) / 1e4,
      praiseCount: msg.praiseCount,
      blessingCnt: c.blessingCount,
      blessings: c.blessings,
    };

    return NextResponse.json(item, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
