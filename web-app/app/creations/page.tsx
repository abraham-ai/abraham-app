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
const PAGE_SIZE = 18;

/* ───────────────────────────────────── component */
export default function CreationsGrid() {
  const { loggedIn } = useAuth();
  const { praise } = useAbrahamContract();

  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("most-praised");
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

        setCreations(firstBatch);
        setPage(0);
        setHasMore(firstBatch.length === PAGE_SIZE);

        /* initialise praise counts = SUM(praiseCount) */
        const cnt: Record<string, number> = {};
        firstBatch.forEach((c) => {
          cnt[c.id] = c.messages.reduce((s, m) => s + m.praiseCount, 0);
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
  }, [sortBy, fetchPage]);

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

            setCreations((prev) => [...prev, ...batch]);
            setPage(next);
            setHasMore(batch.length === PAGE_SIZE);

            const cnt: Record<string, number> = {};
            batch.forEach((c) => {
              cnt[c.id] = c.messages.reduce((s, m) => s + m.praiseCount, 0);
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
  }, [loadingMore, hasMore, page, sortBy, fetchPage]);

  /* -------- derive latest image + praise totals -------- */
  const creationsWithComputed = useMemo(() => {
    return creations.map((c) => {
      const total =
        praiseCounts[c.id] ??
        c.messages.reduce((sum, msg) => sum + msg.praiseCount, 0);

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
    if (sortBy === "most-praised") {
      arr.sort((a, b) => {
        if (b.totalPraises !== a.totalPraises)
          return b.totalPraises - a.totalPraises;
        return Number(b.lastActivityAt) - Number(a.lastActivityAt);
      });
    } else {
      arr.sort((a, b) => Number(b.lastActivityAt) - Number(a.lastActivityAt));
    }
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
          {sorted.map((c) => (
            <div
              key={c.id}
              className="bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
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
                      quality={100}
                      onError={() => console.error("image error")}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-6xl">🎨</span>
                    </div>
                  )}
                </div>
              </Link>

              {/* info */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        className="flex items-center gap-2 text-gray-600 hover:text-blue-500 transition-colors group relative disabled:opacity-50"
                        disabled={c.closed || loadingPraise === c.id}
                      >
                        <span className="text-2xl relative">
                          🙌
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                            {c.closed ? "Closed" : "Praise"}
                          </span>
                        </span>
                        {c.totalPraises > 0 && (
                          <span className="text-lg font-medium">
                            {c.totalPraises}
                          </span>
                        )}
                      </button>
                    </DialogTrigger>
                    {!c.closed && (
                      <DialogContent className="bg-white">
                        <DialogHeader>
                          <DialogTitle>Praise Creation</DialogTitle>
                          <DialogDescription>
                            {PRAISE_PRICE_ETHER.toFixed(5)} ETH will be sent
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            onClick={() => handlePraise(c)}
                            disabled={loadingPraise === c.id}
                          >
                            {loadingPraise === c.id && (
                              <Loader2Icon className="w-4 h-4 animate-spin mr-1" />
                            )}
                            {loadingPraise === c.id ? "Praising…" : "Praise"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    )}
                  </Dialog>

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
      </div>
    </>
  );
}
