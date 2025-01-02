import { NextResponse } from "next/server";
import * as jose from "jose";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import { gql } from "@apollo/client/core";
import apolloClient from "@/lib/apolloClient";
import { ethers } from "ethers";

const SOCIAL_JWKS_URL = "https://api-auth.web3auth.io/jwks";
const WALLET_JWKS_URL = "https://authjs.web3auth.io/jwks";

const ABRAHAM_ADDRESS = process.env.NEXT_PUBLIC_ABRAHAM_ADDRESS || "";
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.ankr.com/base_sepolia";
const OWNER_PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// We'll query the `creationAddeds` entity from the subgraph
// because your schema.graphql defines "type CreationAdded @entity"
const QUERY_CREATION_BY_URI = gql`
  query CreationAddedByURI($uri: String!) {
    creationAddeds(where: { metadataUri: $uri }) {
      id
      metadataUri
      creationId
    }
  }
`;

export const revalidate = 0;

async function creationExistsInSubgraph(metadataUri: string): Promise<boolean> {
  const { data } = await apolloClient.query({
    query: QUERY_CREATION_BY_URI,
    variables: { uri: metadataUri },
    fetchPolicy: "network-only",
  });
  // If data.creationAddeds has length > 0, it means we have at least one CreationAdded event
  // with this metadataUri
  return data.creationAddeds && data.creationAddeds.length > 0;
}

export async function GET() {
  try {
    // 1. Fetch off-chain data
    const response = await fetch(
      "https://edenartlab--abraham2-fastapi-app.modal.run/get_creations"
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch external creations: ${response.statusText}`
      );
    }
    const offchainCreations = await response.json();

    // 2. Set up contract
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
    const abrahamContract = new ethers.Contract(
      ABRAHAM_ADDRESS,
      AbrahamAbi,
      signer
    );

    const finalCreations = [];

    for (const item of offchainCreations) {
      // Extract imageUrl from offchain item
      const imageUrl = item?.result?.output?.[0]?.url;
      if (!imageUrl) {
        // If no imageUrl, just push the item as-is
        finalCreations.push(item);
        continue;
      }

      // 3. Check subgraph if we have a CreationAdded with this imageUrl
      const exists = await creationExistsInSubgraph(imageUrl);

      if (!exists) {
        // 4. Create new on-chain creation
        const tx = await abrahamContract.newCreation(imageUrl);
        await tx.wait();
      }

      // 5. Get on-chain id from the graph
      // 5. Optionally re-query to get the subgraph event data
      const { data } = await apolloClient.query({
        query: QUERY_CREATION_BY_URI,
        variables: { uri: imageUrl },
        fetchPolicy: "network-only",
      });
      console.log("CreationAdded event data:", data);
      const onchainId = data.creationAddeds[0].creationId;

      const onchainData = await abrahamContract.getCreation(onchainId);

      finalCreations.push({
        ...item,
        onchain: {
          id: onchainId.toString(),
          metadataUri: onchainData.uri,
          totalStaked: onchainData.totalStaked.toString(),
          praisePool: onchainData.praisePool.toString(),
          conviction: onchainData.conviction.toString(),
        },
      });
    }

    return NextResponse.json(finalCreations, { status: 200 });
  } catch (err: any) {
    console.error("Error in GET route:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
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
    const actionData = {
      creation_id,
      action,
      user,
    };

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
