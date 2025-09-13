import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy-auth";

import { dbConnect } from "@/lib/mongoose";
import { UserWallet } from "@/models/UserWallet";
import { getCdp } from "@/lib/cdp";

async function createServerWalletForUser(userId: string) {
  // Use a unique, valid name for the account (2-36 chars, alphanumeric and hyphens)
  const name = `abraham-${userId}`.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36);
  const cdp = getCdp();
  const account = await cdp.evm.getOrCreateAccount({ name });
  return {
    walletId: account.address, // SDK object does not expose 'id'; use address as unique identifier
    address: account.address,
  };
}

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
  // Check if user already has a wallet in MongoDB (Mongoose)
  await dbConnect();
  let wallet = await UserWallet.findOne({ privyUserId: user.sub });
  if (!wallet) {
    const newWallet = await createServerWalletForUser(user.sub);
    wallet = await UserWallet.create({
      privyUserId: user.sub,
      walletId: newWallet.walletId,
      address: newWallet.address,
    });
  }
  return NextResponse.json({ wallet });
}
