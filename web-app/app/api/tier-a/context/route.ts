import { NextResponse } from "next/server";
import { requireTierA } from "@/lib/auth/require-tier-a";

export async function GET(req: Request) {
  try {
    const ctx = await requireTierA(req);
    return NextResponse.json(ctx);
  } catch (e: any) {
    const status = e instanceof Response ? e.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }
}
