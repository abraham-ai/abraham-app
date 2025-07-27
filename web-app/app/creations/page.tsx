"use client";

import React, { useEffect, useState } from "react";
import CreationList from "@/components/abraham/creations/CreationList";
import AppBar from "@/components/layout/AppBar";
import { CreationItem } from "@/types/abraham";
import { Loader2Icon, CircleXIcon } from "lucide-react";

export default function Home() {
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      } finally {
        setLoading(false);
      }
    };

    fetchCreations();
  }, []);

  return (
    <div>
      <AppBar />
      <div className="mt-12 mb-12 flex flex-col items-center justify-center w-full ">
        <div className="flex flex-col items-center justify-center border-x ">
          <CreationList creations={creations || []} />
        </div>

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
