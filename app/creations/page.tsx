// pages/index.tsx

"use client";

import React, { useEffect, useState } from "react";
import CreationList from "@/components/abraham/creations/CreationList";
import AppBar from "@/components/layout/AppBar";
import { CreationItem, SubgraphCreation, Metadata } from "@/types";

export default function Home() {
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Replace with your actual subgraph endpoint
  const GRAPHQL_ENDPOINT =
    "https://api.studio.thegraph.com/query/99814/abraham/v0.0.2";

  const GET_CREATIONS_QUERY = `
    query GetCreations($first: Int!) {
      creations(first: $first, orderBy: creationId, orderDirection: asc) {
        id
        creationId
        metadataUri
        totalStaked
        praisePool
        conviction
        createdAt
        updatedAt
      }
    }
  `;

  useEffect(() => {
    const fetchCreations = async () => {
      try {
        // Fetch creations from the subgraph
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
          throw new Error(
            `Network response was not ok: ${response.statusText}`
          );
        }

        const { data, errors } = await response.json();

        if (errors) {
          console.error("GraphQL Errors:", errors);
          setError(errors.map((err: any) => err.message).join(", "));
          setLoading(false);
          return;
        }

        if (data && data.creations) {
          // Fetch metadata for each creation
          const creationsWithMetadata: CreationItem[] = await Promise.all(
            data.creations.map(async (creation: SubgraphCreation) => {
              try {
                const metadataResponse = await fetch(creation.metadataUri);
                if (!metadataResponse.ok) {
                  throw new Error(
                    `Failed to fetch metadata: ${metadataResponse.statusText}`
                  );
                }
                const metadata: Metadata = await metadataResponse.json();
                return {
                  ...creation,
                  title: metadata.title,
                  description: metadata.description,
                  visual_aesthetic: metadata.visual_aesthetic,
                  image: metadata.image,
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
                    "https://ipfs.io/ipfs/bafybeifrq3n5h4onservz3jlcwaeodiy5izwodbxs3ce4z6x5k4i2z4qwy", // Ensure this image exists in your public folder
                };
              }
            })
          );

          setCreations(creationsWithMetadata);
          console.log("Creations with metadata:", creationsWithMetadata);
        } else {
          setError("No data returned from GraphQL query.");
        }
      } catch (err: any) {
        console.error("Fetch Error:", err);
        setError(err.message || "An unknown error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchCreations();
  }, [GRAPHQL_ENDPOINT]);

  if (loading) {
    return (
      <div>
        <AppBar />
        <div className="mt-12 flex flex-col items-center justify-center w-full">
          <p>Loading creations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <AppBar />
        <div className="mt-12 flex flex-col items-center justify-center w-full">
          <p>Error fetching creations: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppBar />
      <div className="mt-12 flex flex-col items-center justify-center w-full">
        <CreationList creations={creations} />
      </div>
    </div>
  );
}
