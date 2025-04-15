"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Creation from "@/components/abraham/creations/Creation";
import AppBar from "@/components/layout/AppBar";
import { CreationItem } from "@/types";
import Blessings from "@/components/abraham/creations/Blessings";
import { useAuth } from "@/context/AuthContext";

export default function CreationPage({ params }: { params: { id: string } }) {
  const [creation, setCreation] = useState<CreationItem | null>(null);
  const [userPraises, setUserPraises] = useState<Set<string>>(new Set());
  const { loggedIn, userAccounts } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchData();
  }, [loggedIn, userAccounts]);

  /**
   * Fetch a single creation from an API route such as `/api/creations/creation?creationId=...`
   */
  const fetchCreation = async () => {
    try {
      const res = await axios.get(
        `/api/creations/creation?creationId=${params.id}`
      );
      console.log("Creation:", res.data);
      setCreation(res.data);
    } catch (err: any) {
      console.error("Fetch Error:", err);
    }
  };

  /**
   * Example: fetch user praises from subgraph. (You can remove if not in use.)
   */
  const fetchUserPraises = async () => {
    if (!loggedIn || !userAccounts) return;
    const userAddress = userAccounts.toLowerCase();
    console.log("User Address: ", userAddress);

    const query = `
      query GetUserPraises($user: Bytes!) {
        praiseds(where: { user: $user }) {
          creationId
        }
      }
    `;

    try {
      const response = await fetch(
        "https://api.studio.thegraph.com/query/99814/abraham-ai/v0.0.2",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables: { user: userAddress } }),
        }
      );

      if (!response.ok) {
        throw new Error(`Network error: ${response.statusText}`);
      }

      const { data, errors } = await response.json();
      console.log("User Praises Data:", data);
      if (errors) {
        console.error("GraphQL Errors:", errors);
        return;
      }

      const praisedIds = data.praiseds.map((p: any) => p.creationId);
      setUserPraises(new Set(praisedIds));
    } catch (err: any) {
      console.error("Error fetching user praises:", err);
    }
  };

  /**
   * Wrapper to fetch everything we need
   */
  const fetchData = async () => {
    setLoading(true);
    await fetchCreation();
    await fetchUserPraises();
    setLoading(false);
  };

  /**
   * Callback that gets triggered after a successful Bless action
   * to immediately add a new blessing to local state.
   *
   * We'll assume your subgraph's "Blessing" objects look like:
   *   { userAddress: string; message: string; ethUsed: string; blockTimestamp?: string; }
   */
  const handleNewBlessing = (newBless: {
    userAddress: string;
    message: string;
    ethUsed: string;
    blockTimestamp?: string;
  }) => {
    if (!creation) return;

    setCreation((prev) => {
      if (!prev) return null;

      // Insert the new blessing at the front for "latest first" ordering:
      const updatedBlessings = [
        { ...newBless, blockTimestamp: newBless.blockTimestamp || "" },
        ...(prev.blessings || []),
      ];
      return {
        ...prev,
        blessings: updatedBlessings,
      };
    });
  };

  return (
    <>
      <AppBar />

      <div className="mt-12 flex flex-col items-center justify-center w-full">
        <div className="flex flex-col items-center justify-center">
          <div className="flex flex-col items-center justify-center border-x ">
            {/* The main creation component */}
            {creation && (
              <Creation creation={creation} onNewBlessing={handleNewBlessing} />
            )}

            {/* 
              Render the blessings in "latest first" order.
              If your subgraph includes blockTimestamp, we can sort by it.
              For example:
            */}
            <div>
              <Blessings
                blessings={
                  creation?.blessings
                    ?.slice() // shallow copy
                    .sort(
                      (a, b) =>
                        // parseInt(b.blockTimestamp) - parseInt(a.blockTimestamp)
                        // If you have blockTimestamp as a string
                        // or if blockTimestamp is missing, remove the parse
                        parseInt(b.blockTimestamp || "0", 10) -
                        parseInt(a.blockTimestamp || "0", 10)
                    ) || []
                }
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
