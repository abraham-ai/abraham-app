import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Blessing from "@/models/Blessing";
import AbrahamCreation from "@/models/AbrahamCreation";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const {
      creationId,
      session_id,
      blesserEoa,
      blesserSmartWallet,
      onchainRef,
    } = body ?? {};

    if (!creationId) {
      return NextResponse.json(
        { error: "creationId is required" },
        { status: 400 }
      );
    }

    // Ensure creation exists
    const creation = await AbrahamCreation.findById(creationId).select("_id");
    if (!creation) {
      return NextResponse.json(
        { error: "Creation not found" },
        { status: 404 }
      );
    }

    // Create blessing record
    const blessing = await Blessing.create({
      creationId,
      session_id,
      blesserEoa: blesserEoa?.toLowerCase?.() ?? null,
      blesserSmartWallet: blesserSmartWallet?.toLowerCase?.() ?? null,
      onchainRef: onchainRef ?? null,
    });

    // Increment total count on the creation doc
    await AbrahamCreation.updateOne(
      { _id: creationId },
      { $inc: { blessingsCount: 1 } }
    );

    return NextResponse.json({ success: true, blessingId: blessing._id });
  } catch (err: any) {
    console.error("[POST /api/covenant/blessings] error:", err);
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
