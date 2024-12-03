// api/pimlico/paymaster/route.ts

import { NextResponse } from "next/server";

export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const pimlicoAPIKey = process.env.PIMLICO_API_KEY;
    if (!pimlicoAPIKey) {
      return NextResponse.json(
        { error: "Pimlico API key not configured" },
        { status: 500 }
      );
    }

    const chainId = "84532"; // Base Sepolia Testnet Chain ID in decimal
    const url = `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoAPIKey}`;

    const body = await request.text();

    // Forward the request to Pimlico's paymaster endpoint
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":
          request.headers.get("Content-Type") || "application/json",
      },
      body: body,
    });

    const responseBody = await response.text();

    return new Response(responseBody, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error: any) {
    console.error(
      "Error proxying request to Pimlico Paymaster:",
      error.message
    );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
