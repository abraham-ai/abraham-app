import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy-auth";

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
  if (!user) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
  return NextResponse.json({ user });
}
