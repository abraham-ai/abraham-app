"use client";

import React, { useEffect, useState } from "react";
import CreationList from "@/components/abraham/creations/CreationList";
import AppBar from "@/components/layout/AppBar";
import { CreationItem } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { Loader2Icon, CircleXIcon } from "lucide-react";

export default function Home() {
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [userPraises, setUserPraises] = useState<Map<string, number>>(
    new Map()
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { loggedIn, userAccounts } = useAuth();

  useEffect(() => {
    const fetchCreations = async () => {
      try {
        const response = await fetch("/api/creations");

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Network error: ${response.statusText}`
          );
        }

        const { creations } = await response.json();
        setCreations(creations);
      } catch (err: any) {
        console.error("Fetch Error:", err);
        setError(err.message || "An unknown error occurred.");
      }
    };

    const fetchUserInteractions = async () => {
      if (!loggedIn || !userAccounts || userAccounts.length === 0) return;

      const userAddress = userAccounts.toLowerCase();
      console.log("User Address: ", userAddress);

      const query = `
        query GetUserInteractions($user: Bytes!) {
          praiseds(where: { user: $user }) {
            creationId
          }
          unpraiseds(where: { user: $user }) {
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

        if (!response.ok)
          throw new Error(`Network error: ${response.statusText}`);

        const { data, errors } = await response.json();

        if (errors) {
          console.error("GraphQL Errors:", errors);
          return;
        }

        const praisedIds: string[] = data.praiseds.map(
          (p: any) => p.creationId
        );
        const unpraisedIds: string[] = data.unpraiseds.map(
          (u: any) => u.creationId
        );

        const praiseMap = new Map<string, number>();

        praisedIds.forEach((id) => {
          praiseMap.set(id, (praiseMap.get(id) || 0) + 1);
        });

        unpraisedIds.forEach((id) => {
          praiseMap.set(id, (praiseMap.get(id) || 0) - 1);
        });

        // Ensure no negative praises
        praiseMap.forEach((value, key) => {
          if (value < 0) praiseMap.set(key, 0);
        });

        setUserPraises(praiseMap);
      } catch (err: any) {
        console.error("Error fetching user interactions:", err);
      }
    };

    const fetchData = async () => {
      setLoading(true);
      await fetchCreations();
      await fetchUserInteractions();
      setLoading(false);
    };

    fetchData();
  }, [loggedIn, userAccounts]);

  return (
    <div>
      <AppBar />
      <div className="mt-12 flex flex-col items-center justify-center w-full">
        <CreationList creations={creations} userPraises={userPraises} />
        {loading && (
          <div className="mt-12 flex flex-col items-center justify-center">
            <Loader2Icon className="w-6 h-6 animate-spin text-primary" />
            <p className="mt-2 text-sm">Loading creations...</p>
          </div>
        )}
        {error && (
          <div className="mt-12 flex flex-col items-center justify-center">
            <CircleXIcon className="w-6 h-6 text-red-500" />
            <p className="mt-2 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
