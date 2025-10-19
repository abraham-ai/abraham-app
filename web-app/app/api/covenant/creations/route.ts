//api/covenant/creations/route.ts
import dbConnect from "@/lib/dbConnect";
import AbrahamCreation, { IAbrahamCreation } from "@/models/AbrahamCreation";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const conn = await dbConnect();
    console.log("Connected to database:", conn.connection.db.databaseName);
    console.log("Querying collection:", AbrahamCreation.collection.name);

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Filter by status="seed"
    const query = { status: "seed" };

    const creations = await AbrahamCreation.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await AbrahamCreation.countDocuments(query);

    console.log("Found creations:", creations.length, "of", total, "total");
    console.log("Sample creation:", creations[0]);
    console.log(
      "All creations:",
      creations.map((c) => ({
        _id: c._id,
        title: c.title,
        image: c.image,
        blessingsCount: c.blessingsCount,
      }))
    );

    return NextResponse.json({
      creations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching creations:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
