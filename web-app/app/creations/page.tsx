"use client";

import React, { useEffect, useState, useMemo } from "react";
import AppBar from "@/components/layout/AppBar";
import { CreationItem } from "@/types/abraham";
import { Loader2Icon, CircleXIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getRelativeTime } from "@/lib/time-utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import {
  useAbrahamContract,
  PRAISE_PRICE_ETHER,
} from "@/hooks/use-abraham-contract";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { showErrorToast, showWarningToast } from "@/lib/error-utils";

type SortOption = "most-praised" | "latest";

export default function CreationsGrid() {
  const { loggedIn, login, loadingAuth } = useAuth();
  const { praise } = useAbrahamContract();
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [praiseCounts, setPraiseCounts] = useState<{[key: string]: number}>({});
  const [loadingPraise, setLoadingPraise] = useState<string | null>(null);

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
        // Initialize praise counts
        const initialCounts: {[key: string]: number} = {};
        creations.forEach((creation: CreationItem) => {
          const ownerAddress = process.env.NEXT_PUBLIC_OWNER_ADDRESS?.toLowerCase() || "";
          const totalPraises = creation.messages.reduce((sum, msg) => sum + msg.praiseCount, 0);
          const blessingCount = creation.messages.filter(
            msg => msg.author.toLowerCase() !== ownerAddress
          ).length;
          initialCounts[creation.id] = totalPraises + (2 * blessingCount);
        });
        setPraiseCounts(initialCounts);
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
      const ownerAddress = process.env.NEXT_PUBLIC_OWNER_ADDRESS?.toLowerCase() || "";
      
      // Use dynamic praise count from state, fallback to calculated
      const currentPraiseCount = praiseCounts[creation.id] ?? (() => {
        const totalPraises = creation.messages.reduce((sum, msg) => sum + msg.praiseCount, 0);
        const blessingCount = creation.messages.filter(
          msg => msg.author.toLowerCase() !== ownerAddress
        ).length;
        return totalPraises + (2 * blessingCount);
      })();
      
      // Find the last Abraham message with an image
      const abrahamMessages = creation.messages.filter(
        msg => msg.author.toLowerCase() === ownerAddress
      );
      const lastImageMessage = [...abrahamMessages]
        .reverse()
        .find(msg => msg.media);
      
      const lastImage = lastImageMessage?.media?.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/") || "";
      const lastMessageUuid = lastImageMessage?.uuid || creation.messageUuid;

      return {
        ...creation,
        totalPraises: currentPraiseCount,
        lastImage: lastImage || creation.image, // fallback to creation.image if no image found
        lastMessageUuid: lastMessageUuid // UUID of the message with the last image
      };
    });
  }, [creations, praiseCounts]);

  // Sort creations based on selected option
  const sortedCreations = useMemo(() => {
    const sorted = [...creationsWithTotalPraises];
    if (sortBy === "most-praised") {
      sorted.sort((a, b) => {
        // Primary sort: by total praises (descending)
        if (b.totalPraises !== a.totalPraises) {
          return b.totalPraises - a.totalPraises;
        }
        // Tiebreaker: by newest first (descending lastActivityAt)
        return Number(b.lastActivityAt) - Number(a.lastActivityAt);
      });
    } else {
      // Latest - already sorted by lastActivityAt from API
      sorted.sort((a, b) => Number(b.lastActivityAt) - Number(a.lastActivityAt));
    }
    return sorted;
  }, [creationsWithTotalPraises, sortBy]);

  const handlePraise = async (creation: any) => {
    if (!loggedIn) {
      showWarningToast("Authentication Required", "Please log in.");
      return;
    }
    setLoadingPraise(creation.id);
    try {
      await praise(creation.id, creation.lastMessageUuid);
      setPraiseCounts(prev => ({
        ...prev,
        [creation.id]: (prev[creation.id] || 0) + 1
      }));
    } finally {
      setLoadingPraise(null);
    }
  };

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
      <div className="mt-16 mb-12 px-2 sm:px-3 lg:px-4 max-w-7xl mx-auto">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedCreations.map((creation) => (
            <div key={creation.id} className="bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              {/* Image - clickable link */}
              <Link href={`/creation/${creation.id}`} className="block">
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
              </Link>

              {/* Info - separate from link */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors group relative"
                        disabled={loadingPraise === creation.id}
                      >
                        <span className="text-2xl relative">
                          🙌
                          <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                            Praise
                          </span>
                        </span>
                        {creation.totalPraises > 0 && (
                          <span className="text-lg font-medium">{creation.totalPraises}</span>
                        )}
                      </button>
                    </DialogTrigger>
                    <DialogContent className="bg-white">
                      <DialogHeader>
                        <DialogTitle>Praise Creation</DialogTitle>
                        <DialogDescription>
                          {PRAISE_PRICE_ETHER.toFixed(5)} ETH will be sent
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button onClick={() => handlePraise(creation)} disabled={loadingPraise === creation.id}>
                          {loadingPraise === creation.id && (
                            <Loader2Icon className="w-4 h-4 animate-spin mr-1" />
                          )}
                          {loadingPraise === creation.id ? "Praising…" : "Praise"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Link href={`/creation/${creation.id}`}>
                    <span className="text-sm text-gray-500 hover:text-gray-700">
                      {getRelativeTime(Number(creation.lastActivityAt) * 1000)}
                    </span>
                  </Link>
                </div>
              </div>
            </div>
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