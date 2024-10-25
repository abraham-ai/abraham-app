import { NextResponse } from "next/server";
import * as jose from "jose";

// JWKS endpoint for social logins
const SOCIAL_JWKS_URL = "https://api-auth.web3auth.io/jwks";
const WALLET_JWKS_URL = "https://authjs.web3auth.io/jwks";

export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { story_id, blessing, address } = body;

    // Ensure that the Authorization header is present
    const token = request.headers.get("Authorization")?.split(" ")[1];
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Decode JWT to verify user authentication
    const decodedToken = jose.decodeJwt(token);
    let jwksUrl = SOCIAL_JWKS_URL;

    // Check if the user is logged in with a wallet, and update JWKS URL if necessary
    if (
      Array.isArray(decodedToken.wallets) &&
      decodedToken.wallets.some((w) => w.type === "ethereum")
    ) {
      jwksUrl = WALLET_JWKS_URL;
    }

    // Fetch the JWKS and verify the JWT
    const jwks = jose.createRemoteJWKSet(new URL(jwksUrl));
    const { payload } = await jose.jwtVerify(token, jwks, {
      algorithms: ["ES256"],
    });

    // Retrieve user identifier (public key or wallet address)
    const publicAddress = Array.isArray(payload.wallets)
      ? payload.wallets.find((x: { type: string }) => x.type === "ethereum")
          ?.address
      : undefined;

    if (publicAddress) {
      // Verify wallet address if using external wallet login
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

    const user = address;
    console.log("User:", user);

    // Prepare the payload for the /bless endpoint
    const blessData = {
      story_id,
      blessing,
      user,
    };

    // Send a POST request to the /bless endpoint
    const apiUrl = "https://edenartlab--abraham-fastapi-app.modal.run/bless";
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ABRAHAM_ADMIN_KEY}`, // Use environment variable for the Abraham admin key
      },
      body: JSON.stringify(blessData),
    });

    if (!response.ok) {
      console.error("Error blessing the story:", response.statusText);
      throw new Error(`Error blessing the story: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("Error processing POST request:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
