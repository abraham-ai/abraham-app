import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy-auth";
import { dbConnect } from "@/lib/mongoose";
import { UserWallet } from "@/models/UserWallet";
import { getCdp, getCdpNetwork } from "@/lib/cdp";
import { encodeFunctionData, parseEther } from "viem";
import { AbrahamAbi } from "@/lib/abis/Abraham";

const CDP_NETWORK = getCdpNetwork();
const CONTRACT = process.env.NEXT_PUBLIC_ABRAHAM_ADDRESS;

const BLESS_PRICE = process.env.BLESS_PRICE || "0.00001"; // ETH

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }
  const token = authHeader.replace("Bearer ", "");
  const user = await verifyPrivyToken(token as string);
  if (!user || !user.sub)
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );

  await dbConnect();
  const wallet = await UserWallet.findOne({ privyUserId: user.sub });
  if (!wallet)
    return NextResponse.json(
      { error: "No wallet found for user" },
      { status: 404 }
    );

  const body = await req.json().catch(() => ({}));
  const sessionId: string = body?.sessionId;
  const messageId: string = body?.messageId;
  const cid: string = body?.cid;
  if (!sessionId || !messageId || !cid)
    return NextResponse.json(
      { error: "sessionId, messageId and cid required" },
      { status: 400 }
    );

  // CDP credentials validated lazily inside getCdp()
  if (!CONTRACT) {
    return NextResponse.json(
      { error: "Contract address not configured" },
      { status: 500 }
    );
  }

  try {
    const cdp = getCdp();

    const data = encodeFunctionData({
      abi: AbrahamAbi as any,
      functionName: "bless",
      args: [sessionId, messageId, cid],
    });

    const tx = await cdp.evm.sendTransaction({
      address: (wallet.walletId || wallet.address) as any,
      transaction: {
        to: CONTRACT as any,
        value: parseEther(BLESS_PRICE),
        data,
      },
      network: CDP_NETWORK as any,
    });

    return NextResponse.json(
      {
        txHash:
          (tx as any).transactionHash ?? (tx as any).transaction_hash ?? tx,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("/api/bless error:", e);
    return NextResponse.json(
      { error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
