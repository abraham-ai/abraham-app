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
import { useAuth } from "@/context/auth-context";
import {
  useAbrahamSmartWallet,
  PRAISE_PRICE_ETHER,
} from "@/hooks/use-abraham-smartwallet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { showWarningToast } from "@/lib/error-utils";
import { HIDDEN_SESSION_IDS } from "@/config/hidden-sessions";

type SortOption = "most-praised" | "latest";
const PAGE_SIZE = 18;

/* ───────────────────────────────────── component */
export default function CreationsGrid() {
  const { loggedIn } = useAuth();
  const { praise } = useAbrahamSmartWallet();

  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [praiseCounts, setPraiseCounts] = useState<Record<string, number>>({});
  const [loadingPraise, setLoadingPraise] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const OWNER = process.env.NEXT_PUBLIC_OWNER_ADDRESS!.toLowerCase();

  /* -------- fetch helper -------- */
  const fetchPage = useCallback(async (pageNo: number, sort: SortOption) => {
    const params = new URLSearchParams({
      first: PAGE_SIZE.toString(),
      skip: (pageNo * PAGE_SIZE).toString(),
      sort,
    });
    const res = await fetch(`/api/creations?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || res.statusText);
    }
    const { creations: batch } = await res.json();
    return batch as CreationItem[];
  }, []);

  /* -------- reset + first load whenever sort changes -------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingInit(true);
      setError(null);
      try {
        const firstBatch = await fetchPage(0, sortBy);
        if (cancelled) return;

        // Filter out hidden sessions at the root level
        const filteredBatch = firstBatch.filter(
          (c) => !HIDDEN_SESSION_IDS.includes(c.id)
        );
        setCreations(filteredBatch);
        setPage(0);
        setHasMore(firstBatch.length === PAGE_SIZE);

        /* initialise praise counts = SUM(praiseCount) + 2 * blessings */
        const cnt: Record<string, number> = {};
        filteredBatch.forEach((c) => {
          const totalPraises = c.messages.reduce(
            (s, m) => s + m.praiseCount,
            0
          );
          const blessingCount = c.messages.filter(
            (m) => m.author.toLowerCase() !== OWNER
          ).length;
          cnt[c.id] = totalPraises + 2 * blessingCount;
        });
        setPraiseCounts(cnt);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoadingInit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sortBy, fetchPage, OWNER]);

  /* -------- infinite scroll -------- */
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting && !loadingMore && hasMore) {
          setLoadingMore(true);
          try {
            const next = page + 1;
            const batch = await fetchPage(next, sortBy);

            // Filter out hidden sessions at the root level
            const filteredBatch = batch.filter(
              (c) => !HIDDEN_SESSION_IDS.includes(c.id)
            );
            setCreations((prev) => [...prev, ...filteredBatch]);
            setPage(next);
            setHasMore(batch.length === PAGE_SIZE);

            const cnt: Record<string, number> = {};
            filteredBatch.forEach((c) => {
              const totalPraises = c.messages.reduce(
                (s, m) => s + m.praiseCount,
                0
              );
              const blessingCount = c.messages.filter(
                (m) => m.author.toLowerCase() !== OWNER
              ).length;
              cnt[c.id] = totalPraises + 2 * blessingCount;
            });
            setPraiseCounts((prev) => ({ ...prev, ...cnt }));
          } catch (err: any) {
            setError(err.message);
          } finally {
            setLoadingMore(false);
          }
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadingMore, hasMore, page, sortBy, fetchPage, OWNER]);

  /* -------- derive latest image + praise totals -------- */
  const creationsWithComputed = useMemo(() => {
    return creations.map((c) => {
      const total =
        praiseCounts[c.id] ??
        (() => {
          const totalPraises = c.messages.reduce(
            (sum, msg) => sum + msg.praiseCount,
            0
          );
          const blessingCount = c.messages.filter(
            (m) => m.author.toLowerCase() !== OWNER
          ).length;
          return totalPraises + 2 * blessingCount;
        })();

      const abrahamMsgs = c.messages.filter(
        (m) => m.author.toLowerCase() === OWNER
      );
      const latestImgMsg = [...abrahamMsgs].reverse().find((m) => m.media);

      return {
        ...c,
        totalPraises: total,
        lastImage:
          latestImgMsg?.media?.replace(
            /^ipfs:\/\//,
            "https://gateway.pinata.cloud/ipfs/"
          ) || c.image,
        lastMessageUuid: latestImgMsg?.uuid || c.messageUuid,
      };
    });
  }, [creations, praiseCounts, OWNER]);

  /* -------- local sort (fallback) -------- */
  const sorted = useMemo(() => {
    const arr = [...creationsWithComputed];
    arr.sort((a, b) => {
      // Primary sort: open creations first
      if (a.closed !== b.closed) {
        return a.closed ? 1 : -1;
      }

      // Secondary sort based on selected option
      if (sortBy === "most-praised") {
        // By praise count
        if (b.totalPraises !== a.totalPraises) {
          return b.totalPraises - a.totalPraises;
        }
        // Tertiary: by latest activity
        return Number(b.lastActivityAt) - Number(a.lastActivityAt);
      } else {
        // By latest activity
        return Number(b.lastActivityAt) - Number(a.lastActivityAt);
      }
    });
    return arr;
  }, [creationsWithComputed, sortBy]);

  /* -------- praise action -------- */
  const handlePraise = async (c: { id: string; lastMessageUuid: string }) => {
    if (!loggedIn) {
      showWarningToast("Authentication Required", "Please log in.");
      return;
    }
    if (loadingPraise) return;
    setLoadingPraise(c.id);
    try {
      // Queued; auto-batches to one approval for bursts
      await praise(c.id, c.lastMessageUuid);
      setPraiseCounts((prev) => ({
        ...prev,
        [c.id]: (prev[c.id] ?? 0) + 1,
      }));
    } finally {
      setLoadingPraise(null);
    }
  };

  /* ──────────────── RENDER STATES ─────────────── */
  if (loadingInit) {
    return (
      <>
        <AppBar />
        <div className="mt-24 flex flex-col items-center">
          <Loader2Icon className="w-6 h-6 animate-spin text-primary" />
          <p className="mt-2 text-sm">Loading creations…</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AppBar />
        <div className="mt-24 flex flex-col items-center">
          <CircleXIcon className="w-6 h-6 text-red-500" />
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </>
    );
  }

  /* ──────────────── MAIN GRID ─────────────── */
  return (
    <>
      <AppBar />
      <div className="mt-16 mb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* sort controls */}
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

        {/* grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sorted
            .filter((c) => !HIDDEN_SESSION_IDS.includes(c.id))
            .map((c) => (
              <div
                key={c.id}
                className="bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-shadow relative"
              >
                {/* image link */}
                <Link href={`/creation/${c.id}`} className="block">
                  <div className="aspect-square relative bg-gray-100">
                    {c.lastImage ? (
                      <Image
                        src={c.lastImage}
                        alt={c.description}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover"
                        quality={75}
                        onError={() => console.error("image error")}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <span className="text-6xl">🎨</span>
                      </div>
                    )}
                    {/* White overlay for closed creations */}
                    {c.closed && (
                      <div className="absolute inset-0 bg-white/60 pointer-events-none" />
                    )}
                  </div>
                </Link>

                {/* info */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors disabled:opacity-50"
                            disabled={c.closed || loadingPraise === c.id}
                            onClick={
                              !c.closed ? () => handlePraise(c) : undefined
                            }
                          >
                            {loadingPraise === c.id ? (
                              <Loader2Icon className="w-5 h-5 animate-spin" />
                            ) : (
                              <span className="text-2xl">🙌</span>
                            )}
                            {c.totalPraises > 0 && (
                              <span className="text-lg font-medium">
                                {c.totalPraises}
                              </span>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="bg-gray-800 text-white border-gray-700"
                        >
                          {c.closed ? (
                            <div>Closed</div>
                          ) : (
                            <div>
                              <div className="font-medium">Praise Creation</div>
                              <div className="text-xs">
                                {PRAISE_PRICE_ETHER.toFixed(5)} ETH will be sent
                              </div>
                            </div>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Link href={`/creation/${c.id}`}>
                      <span className="text-sm text-gray-500 hover:text-gray-700">
                        {getRelativeTime(Number(c.lastActivityAt) * 1000)}
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* infinite-scroll sentinel */}
        <div ref={sentinelRef} className="h-px" />
        {loadingMore && (
          <div className="flex justify-center py-6">
            <Loader2Icon className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        {sorted.length === 0 && !loadingMore && (
          <p className="text-center py-12 text-gray-500">No creations yet</p>
        )}

        {/* Display visible session IDs */}
        {sorted.filter((c) => !HIDDEN_SESSION_IDS.includes(c.id)).length >
          0 && (
          <div className="mt-8 mb-4 text-center">
            <p className="text-sm text-gray-500">
              Visible session IDs:{" "}
              {sorted
                .filter((c) => !HIDDEN_SESSION_IDS.includes(c.id))
                .map((c) => `"${c.id}"`)
                .join(", ")}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
