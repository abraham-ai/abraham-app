//api/covenant/creations/route.ts
import dbConnect from "@/lib/dbConnect";
import AbrahamCreation, { IAbrahamCreation } from "@/models/AbrahamCreation";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await dbConnect();
    const creations = await AbrahamCreation.find();
    return NextResponse.json(creations);
  } catch (error) {
    console.error("Error fetching creations:", error);
    return NextResponse.error();
  }
}
