import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SubgraphCreation, Metadata } from "@/types";

// Environment variable for GraphQL endpoint
const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "";

// GraphQL query to fetch a single creation
const GET_CREATION_QUERY = `
  query GetCreation($creationId: String!) {
    creations(where: { creationId: $creationId }) {
      id
      creationId
      metadataUri
      totalEthUsed
      blessCount
      praiseCount
      burnCount
      currentPriceToPraise
      createdAt
      updatedAt
      praises {
        userAddress
        noOfPraises
        ethUsed
      }
      burns {
        userAddress
        noOfBurns
        ethUsed
      }
      blessings {
        userAddress
        message
        ethUsed
      }
    }
  }
`;

// Revalidation setting (optional)
export const revalidate = 0;

// Define the GET handler
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const creationId = url.searchParams.get("creationId");

    if (!creationId) {
      return NextResponse.json(
        { error: "Missing or invalid 'creationId' parameter." },
        { status: 400 }
      );
    }

    // Fetch a single creation from the GraphQL endpoint
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: GET_CREATION_QUERY,
        variables: { creationId },
      }),
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }

    const { data, errors } = await response.json();

    if (errors) {
      console.error("GraphQL Errors:", errors);
      return NextResponse.json(
        { error: errors.map((err: any) => err.message).join(", ") },
        { status: 500 }
      );
    }

    if (data && data.creations.length > 0) {
      const creation: SubgraphCreation = data.creations[0];

      try {
        // Extract CID from metadataUri
        const cid = creation.metadataUri.replace(
          /^ipfs:\/\/|^https:\/\/[^/]+\/ipfs\//,
          ""
        );
        console.log("CID:", cid);

        // Fetch metadata from IPFS
        const metadataResponse = await fetch(`https://ipfs.io/ipfs/${cid}`);
        if (!metadataResponse.ok) {
          throw new Error(
            `Failed to fetch metadata: ${metadataResponse.statusText}`
          );
        }

        const metadata: Metadata = await metadataResponse.json();
        const imageCid = metadata.image.replace(
          /^ipfs:\/\/|^https:\/\/[^/]+\/ipfs\//,
          ""
        );

        const creationWithMetadata = {
          ...creation,
          title: metadata.title,
          description: metadata.description,
          visual_aesthetic: metadata.visual_aesthetic,
          image: `https://ipfs.io/ipfs/${imageCid}`,
        };

        return NextResponse.json(creationWithMetadata, { status: 200 });
      } catch (metaError: any) {
        console.error(
          `Error fetching metadata for creationId ${creationId}:`,
          metaError
        );

        // Provide default values if metadata fetch fails
        const fallbackCreation = {
          ...creation,
          title: "Unknown Title",
          description: "No description available.",
          visual_aesthetic: "Unknown",
          image:
            "https://ipfs.io/ipfs/bafybeifrq3n5h4onservz3jlcwaeodiy5izwodbxs3ce4z6x5k4i2z4qwy", // Fallback image
        };
        return NextResponse.json(fallbackCreation, { status: 200 });
      }
    } else {
      return NextResponse.json(
        { error: "Creation not found." },
        { status: 404 }
      );
    }
  } catch (err: any) {
    console.error("Fetch Error:", err);
    return NextResponse.json(
      { error: err.message || "An unknown error occurred." },
      { status: 500 }
    );
  }
}
