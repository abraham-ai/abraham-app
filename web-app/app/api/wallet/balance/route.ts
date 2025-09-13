import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy-auth";
import { dbConnect } from "@/lib/mongoose";
import { UserWallet } from "@/models/UserWallet";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }
  const token = authHeader.replace("Bearer ", "");
  const user = await verifyPrivyToken(token);
  if (!user || !user.sub) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
  await dbConnect();
  const wallet = await UserWallet.findOne({ privyUserId: user.sub });
  if (!wallet) {
    return NextResponse.json(
      { error: "No wallet found for user" },
      { status: 404 }
    );
  }
  // Fetch native ETH balance using ethers
  const { ethers } = await import("ethers");
  const rpcUrl = process.env.ETH_RPC_URL;
  if (!rpcUrl) {
    return NextResponse.json(
      { error: "ETH_RPC_URL not configured" },
      { status: 500 }
    );
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const rawBalance = await provider.getBalance(wallet.address);
  const balance = ethers.formatEther(rawBalance);
  return NextResponse.json({ balance, address: wallet.address });
}
