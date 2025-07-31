"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import AppBar from "@/components/layout/AppBar";
import { CreationItem } from "@/types/abraham";
import { Loader2Icon, CircleXIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getRelativeTime } from "@/lib/time-utils";
import { Button } from "@/components/ui/button";

type SortOption = "most-praised" | "latest";

const PAGE_SIZE = 18;

export default function CreationsGrid() {
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("most-praised");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  /* -------------------------------- fetch helper */
  const fetchPage = useCallback(async (pageNo: number) => {
    const params = new URLSearchParams({
      first: PAGE_SIZE.toString(),
      skip: (pageNo * PAGE_SIZE).toString(),
    });
    const response = await fetch(`/api/creations?${params.toString()}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || response.statusText);
    }
    const { creations: newCreations } = await response.json();
    return newCreations as CreationItem[];
  }, []);

  /* -------------------------------- first load */
  useEffect(() => {
    (async () => {
      try {
        const firstBatch = await fetchPage(0);
        setCreations(firstBatch);
        setHasMore(firstBatch.length === PAGE_SIZE);
      } catch (err: any) {
        setError(err.message || "An unknown error occurred.");
      } finally {
        setLoadingInitial(false);
      }
    })();
  }, [fetchPage]);

  /* -------------------------------- infinite scroll */
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting && !loadingMore && hasMore) {
          setLoadingMore(true);
          try {
            const nextPage = page + 1;
            const batch = await fetchPage(nextPage);
            setCreations((c) => [...c, ...batch]);
            setPage(nextPage);
            setHasMore(batch.length === PAGE_SIZE);
          } catch (err: any) {
            console.error(err);
            setError(err.message || "An unknown error occurred.");
          } finally {
            setLoadingMore(false);
          }
        }
      },
      { rootMargin: "600px" } // pre-fetch while 600 px away
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [sentinelRef.current, hasMore, loadingMore, page, fetchPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const creationsWithTotalPraises = useMemo(() => {
    const ownerAddress =
      process.env.NEXT_PUBLIC_OWNER_ADDRESS?.toLowerCase() || "";
    return creations.map((creation) => {
      const totalPraises = creation.messages.reduce(
        (sum, msg) => sum + msg.praiseCount,
        0
      );

      const abrahamMessages = creation.messages.filter(
        (msg) => msg.author.toLowerCase() === ownerAddress
      );
      const lastImage =
        [...abrahamMessages]
          .reverse()
          .find((msg) => msg.media)
          ?.media?.replace(/^ipfs:\/\//, "https://ipfs.io/ipfs/") || "";

      return {
        ...creation,
        totalPraises,
        lastImage: lastImage || creation.image,
      };
    });
  }, [creations]);

  const sortedCreations = useMemo(() => {
    const sorted = [...creationsWithTotalPraises];
    if (sortBy === "most-praised") {
      sorted.sort((a, b) => b.totalPraises - a.totalPraises);
    } else {
      sorted.sort(
        (a, b) => Number(b.lastActivityAt) - Number(a.lastActivityAt)
      );
    }
    return sorted;
  }, [creationsWithTotalPraises, sortBy]);

  /* ───────────────────────────────────── render states */
  if (loadingInitial) {
    return (
      <div>
        <AppBar />
        <div className="mt-24 flex flex-col items-center justify-center">
          <Loader2Icon className="w-6 h-6 animate-spin text-primary" />
          <p className="mt-2 text-sm">Loading creations…</p>
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
                        <span className="text-lg font-medium">
                          {creation.totalPraises}
                        </span>
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

        {/* infinite-scroll sentinel & loader */}
        <div ref={sentinelRef} className="h-px" />
        {loadingMore && (
          <div className="flex justify-center py-6">
            <Loader2Icon className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {sortedCreations.length === 0 && !loadingMore && (
          <div className="text-center py-12 text-gray-500">
            No creations yet
          </div>
        )}
      </div>
    </div>
  );
}
