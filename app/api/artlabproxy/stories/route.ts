import { NextResponse } from "next/server";
import * as jose from "jose";

// JWKS endpoint for social logins
const SOCIAL_JWKS_URL = "https://api-auth.web3auth.io/jwks";
const WALLET_JWKS_URL = "https://authjs.web3auth.io/jwks";

export const revalidate = 0;

export async function GET() {
  const apiUrl =
    "https://edenartlab--abraham-fastapi-app.modal.run/get_stories";

  try {
    // Fetch stories from the external API
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Error fetching stories: ${response.statusText}`);
    }

    const stories = await response.json();
    return NextResponse.json(stories, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching stories:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { story_id, action, address } = body;

    const token = request.headers.get("Authorization")?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = jose.decodeJwt(token);
    console.log("Decoded token:", decodedToken);
    let jwksUrl = SOCIAL_JWKS_URL;

    if (
      Array.isArray(decodedToken.wallets) &&
      decodedToken.wallets.some((w) => w.type === "ethereum")
    ) {
      jwksUrl = WALLET_JWKS_URL;
      console.log("Using wallet JWKS URL:", jwksUrl);
    }

    const jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
    const { payload } = await jose.jwtVerify(token, jwks, {
      algorithms: ["ES256"],
    });

    const publicAddress = Array.isArray(payload.wallets)
      ? payload.wallets.find((x: { type: string }) => x.type === "ethereum")
          ?.address
      : undefined;

    if (publicAddress) {
      // Verify publicAddress for external wallet login
      const walletAddress = (
        payload.wallets as { type: string; address: string }[]
      )?.find((x) => x.type === "ethereum")?.address;
      if (
        !walletAddress ||
        walletAddress.toLowerCase() !== publicAddress.toLowerCase()
      ) {
        return NextResponse.json(
          { error: "Invalid wallet address" },
          { status: 400 }
        );
      }
    } else {
      // Verify social login by checking public_key
      const userPublicKey = Array.isArray(payload.wallets)
        ? payload.wallets.find(
            (x: { type: string }) => x.type === "web3auth_app_key"
          )?.public_key
        : undefined;
      if (!userPublicKey) {
        return NextResponse.json(
          { error: "Invalid JWT for social login" },
          { status: 400 }
        );
      }
    }
    console.log("Payload:", payload);

    const user = address;
    console.log("User:", user);

    // Prepare the payload for the /react endpoint
    const actionData = {
      story_id,
      action,
      user,
    };

    // Send a POST request to the /react endpoint
    const apiUrl = "https://edenartlab--abraham-fastapi-app.modal.run/react";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ABRAHAM_ADMIN_KEY}`,
      },
      body: JSON.stringify(actionData),
    });

    if (!response.ok) {
      console.error("Error reacting to story:", response.statusText);
      throw new Error(`Error reacting to story: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Error processing POST request:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
