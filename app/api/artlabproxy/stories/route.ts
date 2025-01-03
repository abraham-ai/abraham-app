import { NextResponse } from "next/server";
import * as jose from "jose";

// JWKS endpoints for authentication
const SOCIAL_JWKS_URL = "https://api-auth.web3auth.io/jwks";
const WALLET_JWKS_URL = "https://authjs.web3auth.io/jwks";

export const revalidate = 0;

export async function GET() {
  const apiUrl =
    "https://edenartlab--abraham2-fastapi-app.modal.run/get_creations";

  try {
    // Fetch creations from the external API
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Error fetching creations: ${response.statusText}`);
    }

    const creations = await response.json();
    return NextResponse.json(creations, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching creations:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { creation_id, action, address } = body;

    const token = request.headers.get("Authorization")?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Decode and verify JWT
    const decodedToken = jose.decodeJwt(token);
    let jwksUrl = SOCIAL_JWKS_URL;

    if (
      Array.isArray(decodedToken.wallets) &&
      decodedToken.wallets.some((w) => w.type === "ethereum")
    ) {
      jwksUrl = WALLET_JWKS_URL;
    }

    const jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
    await jose.jwtVerify(token, jwks, {
      algorithms: ["ES256"],
    });

    const user = address;

    // Prepare the payload for the /react endpoint
    const actionData = {
      creation_id,
      action,
      user,
    };

    console.log("actionData:", actionData);

    // Send a POST request to the /react endpoint
    const apiUrl = "https://edenartlab--abraham2-fastapi-app.modal.run/react";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ABRAHAM_ADMIN_KEY}`,
      },
      body: JSON.stringify(actionData),
    });

    if (!response.ok) {
      console.error("Error reacting to creation:", response.statusText);
      throw new Error(`Error reacting to creation: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Error processing POST request:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
