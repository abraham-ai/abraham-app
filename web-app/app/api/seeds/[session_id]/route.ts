//api/seeds/[session_id]/route.ts
import dbConnect from "@/lib/dbConnect";
import AbrahamCreation from "@/models/AbrahamCreation";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { session_id: string } }
) {
  try {
    await dbConnect();
    const { session_id } = params;

    const seed = await AbrahamCreation.findOne({ session_id }).lean();

    if (!seed) {
      return NextResponse.json({ error: "Seed not found" }, { status: 404 });
    }

    return NextResponse.json(seed);
  } catch (error) {
    console.error("Error fetching seed:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
