//api/creations/route.ts
import dbConnect from "@/lib/dbConnect";
import AbrahamCreation from "@/models/AbrahamCreation";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Filter by status="creation" and contract address
    const query = {
      status: "creation",
      "creation.contract_address": "0x0b3b016Ae434bE0E314058Cf78FAe5C1F0187AAf"
    };

    const creations = await AbrahamCreation.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await AbrahamCreation.countDocuments(query);

    console.log("Found creations with status='creation':", creations.length, "of", total, "total");

    return NextResponse.json({
      creations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching creations:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
