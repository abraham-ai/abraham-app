// app/api/creations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { CreationItem, SubgraphCreation } from "@/types/abraham";

const ENDPOINT =
  "https://api.studio.thegraph.com/query/102152/abraham/version/latest";

const LIST_QUERY = `
  query AllCreations($first:Int!) {
    creations(first:$first,orderBy:id,orderDirection:desc) {
      id
      abrahamMessageCount
      blessingCount
      ethSpentTotal
      abrahamMessages(orderBy:index,orderDirection:desc,first:1){
        index content media praiseCount
      }
      blessings{ author content praiseCount timestamp }
    }
  }`;

export const revalidate = 0; // always fresh

export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: LIST_QUERY,
        variables: { first: 100 },
      }),
    });

    const { data, errors } = await res.json();
    if (errors) throw new Error(errors.map((e: any) => e.message).join(","));

    const creations: CreationItem[] = (
      data.creations as SubgraphCreation[]
    ).map((c) => {
      const msg = c.abrahamMessages[0]; // last AbrahamMessage
      const http = msg.media.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/");
      return {
        id: c.id,
        image: http,
        description: msg.content,
        ethTotal:
          Number((BigInt(c.ethSpentTotal) / BigInt(1e14)).toString()) / 1e4, // wei→ETH float, keep 4dec
        praiseCount: msg.praiseCount,
        blessingCnt: c.blessingCount,
        blessings: c.blessings,
      };
    });

    return NextResponse.json({ creations }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "fetch failed" },
      { status: 500 }
    );
  }
}
