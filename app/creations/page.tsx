"use client";

import React, { useEffect, useState } from "react";
import CreationList from "@/components/abraham/creations/CreationList";
import AppBar from "@/components/layout/AppBar";
import { CreationItem } from "@/types";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [userPraises, setUserPraises] = useState<Set<string>>(new Set());
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

    const fetchUserPraises = async () => {
      if (!loggedIn || !userAccounts || userAccounts.length === 0) return;
      console.log("User Accounts: ", userAccounts);
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
          "https://api.studio.thegraph.com/query/99814/abraham/v0.0.2",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, variables: { user: userAddress } }),
          }
        );

        if (!response.ok)
          throw new Error(`Network error: ${response.statusText}`);

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

    const fetchData = async () => {
      setLoading(true);
      await fetchCreations();
      await fetchUserPraises();
      setLoading(false);
    };

    fetchData();
  }, [loggedIn, userAccounts]);

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
        <CreationList creations={creations} userPraises={userPraises} />
      </div>
    </div>
  );
}
