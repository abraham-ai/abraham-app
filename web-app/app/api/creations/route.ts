// app/api/creations/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CreationItem, SubgraphCreation, Metadata } from "@/types";

// Environment variable for GraphQL endpoint
const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "";

// GraphQL query to fetch creations
const GET_CREATIONS_QUERY = `
  query GetCreations($first: Int!) {
    creations(first: $first, orderBy: creationId, orderDirection: desc) {
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
    // Fetch creations from the GraphQL endpoint
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: GET_CREATIONS_QUERY,
        variables: {
          first: 100, // Adjust based on expected number of creations
        },
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

    if (data && data.creations) {
      // Fetch metadata for each creation
      const creationsWithMetadata: CreationItem[] = await Promise.all(
        data.creations.map(async (creation: SubgraphCreation) => {
          try {
            // Extract CID from metadataUri
            const cid = creation.metadataUri.replace(
              /^ipfs:\/\/|^https:\/\/[^/]+\/ipfs\//,
              ""
            );
            //console.log("CID:", cid);

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

            return {
              ...creation,
              title: metadata.title,
              description: metadata.description,
              visual_aesthetic: metadata.visual_aesthetic,
              image: `https://ipfs.io/ipfs/${imageCid}`,
            };
          } catch (metaError: any) {
            console.error(
              `Error fetching metadata for creationId ${creation.creationId}:`,
              metaError
            );
            // Provide default values if metadata fetch fails
            return {
              ...creation,
              title: "Unknown Title",
              description: "No description available.",
              visual_aesthetic: "Unknown",
              image:
                "https://ipfs.io/ipfs/bafybeifrq3n5h4onservz3jlcwaeodiy5izwodbxs3ce4z6x5k4i2z4qwy", // Ensure this image exists or replace with a valid URL
            };
          }
        })
      );

      return NextResponse.json(
        { creations: creationsWithMetadata },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { error: "No data returned from GraphQL query." },
        { status: 500 }
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
