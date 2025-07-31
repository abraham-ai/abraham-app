"use client";

import React, { useEffect, useState, useMemo } from "react";
import AppBar from "@/components/layout/AppBar";
import { CreationItem } from "@/types/abraham";
import { Loader2Icon, CircleXIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getRelativeTime } from "@/lib/time-utils";
import { Button } from "@/components/ui/button";

type SortOption = "most-praised" | "latest";

export default function CreationsGrid() {
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("most-praised");

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

  // Calculate total praises for each creation
  const creationsWithTotalPraises = useMemo(() => {
    return creations.map(creation => {
      const totalPraises = creation.messages.reduce((sum, msg) => sum + msg.praiseCount, 0);
      
      // Find the last image from Abraham's messages
      const ownerAddress = process.env.NEXT_PUBLIC_OWNER_ADDRESS?.toLowerCase() || "";
      const abrahamMessages = creation.messages.filter(
        msg => msg.author.toLowerCase() === ownerAddress
      );
      const lastImage = [...abrahamMessages]
        .reverse()
        .find(msg => msg.media)?.media?.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/") || "";

      return {
        ...creation,
        totalPraises,
        lastImage: lastImage || creation.image // fallback to creation.image if no image found
      };
    });
  }, [creations]);

  // Sort creations based on selected option
  const sortedCreations = useMemo(() => {
    const sorted = [...creationsWithTotalPraises];
    if (sortBy === "most-praised") {
      sorted.sort((a, b) => b.totalPraises - a.totalPraises);
    } else {
      // Latest - already sorted by lastActivityAt from API
      sorted.sort((a, b) => Number(b.lastActivityAt) - Number(a.lastActivityAt));
    }
    return sorted;
  }, [creationsWithTotalPraises, sortBy]);

  if (loading) {
    return (
      <div>
        <AppBar />
        <div className="mt-24 flex flex-col items-center justify-center">
          <Loader2Icon className="w-6 h-6 animate-spin text-primary" />
          <p className="mt-2 text-sm">Loading creations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <AppBar />
        <div className="mt-24 flex flex-col items-center justify-center">
          <CircleXIcon className="w-6 h-6 text-red-500" />
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppBar />
      <div className="mt-16 mb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Sort controls */}
        <div className="flex justify-end mb-6">
          <div className="flex gap-2">
            <Button
              variant={sortBy === "most-praised" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("most-praised")}
            >
              Most Praised
            </Button>
            <Button
              variant={sortBy === "latest" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("latest")}
            >
              Latest
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCreations.map((creation) => (
            <Link
              key={creation.id}
              href={`/creation/${creation.id}`}
              className="group block"
            >
              <div className="bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                {/* Image */}
                <div className="aspect-square relative bg-gray-100">
                  {creation.lastImage ? (
                    <Image
                      src={creation.lastImage}
                      alt={creation.description}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-6xl">🎨</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🙌</span>
                      {creation.totalPraises > 0 && (
                        <span className="text-lg font-medium">{creation.totalPraises}</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {getRelativeTime(Number(creation.lastActivityAt) * 1000)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {sortedCreations.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No creations yet
          </div>
        )}
      </div>
    </div>
  );
}