import { NextResponse } from "next/server";
import { encodeFunctionData } from "viem";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import { requireTierA } from "@/lib/auth/require-tier-a";
import { cdpSendTransaction } from "@/lib/cdp/client";
import { getTierAPolicy, isAllowedTierA } from "@/lib/policy/tierA";

const ABRAHAM = process.env.NEXT_PUBLIC_ABRAHAM_ADDRESS as `0x${string}`;

const PRAISE_PRICE_WEI = "10000000000000"; // 1e13 wei

export async function POST(req: Request) {
  try {
    if (!ABRAHAM)
      return NextResponse.json(
        { error: "Contract not configured" },
        { status: 500 }
      );
    const ctx = await requireTierA(req);
    const body = await req.json().catch(() => ({}));
    const { sessionId, messageId } = body as {
      sessionId?: string;
      messageId?: string;
    };
    if (!sessionId || !messageId)
      return NextResponse.json(
        { error: "sessionId and messageId required" },
        { status: 400 }
      );

    const data = encodeFunctionData({
      abi: AbrahamAbi,
      functionName: "praise",
      args: [sessionId, messageId],
    });

    // policy gate
    const policy = getTierAPolicy(ctx.chainId);
    const allowed = isAllowedTierA(policy, {
      to: ABRAHAM,
      selector: data.slice(0, 10) as any,
      valueWei: BigInt(PRAISE_PRICE_WEI),
    });
    if (!allowed)
      return NextResponse.json({ error: "Policy denied" }, { status: 403 });

    const { hash } = await cdpSendTransaction({
      from: ctx.activityAddress,
      to: ABRAHAM,
      data,
      value: PRAISE_PRICE_WEI,
      chainId: ctx.chainId,
    });
    return NextResponse.json({ hash, userId: ctx.userId });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Server error";
    const status = e instanceof Response ? e.status : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
