"use client";

import { useEffect, useState, useCallback } from "react";
import AppBar from "@/components/layout/AppBar";
import {
  Loader2Icon,
  CircleXIcon,
  TrophyIcon,
  MedalIcon,
  AwardIcon,
} from "lucide-react";
import { formatEther } from "viem";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import { Button } from "@/components/ui/button";

export interface CuratorData {
  id: string; // address
  totalLinked: string;
  praisesGiven: number;
  praisesReceived: number;
  blessingsGiven: number;
  totalPoints: string;
  rank: number;
  maxStakeDays: number;
}

interface LeaderboardResponse {
  curators: CuratorData[];
  pagination: {
    first: number;
    skip: number;
    hasMore: boolean;
  };
}

const PAGE_SIZE = 20;

export default function LeaderboardPage() {
  const [curators, setCurators] = useState<CuratorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const fetchCurators = useCallback(async (pageNum: number, append = false) => {
    try {
      const skip = pageNum * PAGE_SIZE;
      console.log(`Fetching curators: page ${pageNum}, skip ${skip}`);

      const response = await fetch(
        `/api/leaderboard?first=${PAGE_SIZE}&skip=${skip}`
      );

      console.log("Fetch response status:", response.status);
      console.log(
        "Fetch response headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response text:", errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        throw new Error(errorData.error || response.statusText);
      }

      const responseText = await response.text();
      console.log(
        "Response text (first 200 chars):",
        responseText.substring(0, 200)
      );

      let data: LeaderboardResponse;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Failed to parse JSON:", parseError);
        throw new Error(
          `Invalid JSON response: ${responseText.substring(0, 100)}`
        );
      }

      console.log("Parsed data:", data);

      if (append) {
        setCurators((prev) => [...prev, ...data.curators]);
      } else {
        setCurators(data.curators);
      }

      setHasMore(data.pagination.hasMore);
      setPage(pageNum);
    } catch (err: any) {
      console.error("fetchCurators error:", err);
      setError(err.message);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await fetchCurators(0);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCurators]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      await fetchCurators(page + 1, true);
    } finally {
      setLoadingMore(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatPoints = (points: string) => {
    const pointsBigInt = BigInt(points);
    if (pointsBigInt === BigInt(0)) return "0";

    // Points are now a composite score, not wei
    // Display as a simple number
    const num = Number(pointsBigInt);

    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    } else {
      return num.toFixed(0);
    }
  };

  const formatStake = (stake: string) => {
    const formatted = formatEther(BigInt(stake));
    const num = Number.parseFloat(formatted);

    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toFixed(2);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <TrophyIcon className="w-5 h-5 text-amber-500" />;
      case 2:
        return <MedalIcon className="w-5 h-5 text-slate-400" />;
      case 3:
        return <AwardIcon className="w-5 h-5 text-orange-400" />;
      default:
        return null;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-500 text-white";
      case 3:
        return "bg-gradient-to-r from-amber-400 to-amber-600 text-white";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <>
        <AppBar />
        <div className="mt-24 flex flex-col items-center">
          <Loader2Icon className="w-6 h-6 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">
            Loading leaderboard...
          </p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AppBar />
        <div className="mt-24 flex flex-col items-center max-w-2xl mx-auto px-4">
          <CircleXIcon className="w-8 h-8 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-red-600 mb-2">
            Failed to load leaderboard
          </h2>
          <p className="text-sm text-red-600 text-center mb-4">{error}</p>
          <Button
            onClick={() => {
              setError(null);
              setLoading(true);
              fetchCurators(0).finally(() => setLoading(false));
            }}
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <AppBar />
      <div className="mt-20 mb-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-3 text-balance">
            Curator Leaderboard
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed mb-3">
            Top curators ranked by activity and stake commitment over time
          </p>
          <div className="text-sm text-muted-foreground/80 bg-muted/30 rounded-lg p-4 border border-border/50">
            <span className="font-medium">Scoring:</span> Blessings (20 pts) +
            Praises given (10 pts) + Praises received (5 pts) + (Stake × Days)
          </div>
        </div>

        {/* Leaderboard */}
        {curators.length === 0 && !loading ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-2">No curators found</p>
            <p className="text-sm text-muted-foreground/70">
              The subgraph may still be indexing or there are no active curators
              yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {curators.map((curator) => (
              <div
                key={curator.id}
                className="group relative bg-background border border-border rounded-lg p-5 transition-all hover:border-foreground/20 hover:shadow-sm"
              >
                <div className="flex items-center gap-5">
                  {/* Rank indicator */}
                  <div className="flex-shrink-0 w-12 flex items-center justify-center">
                    {curator.rank <= 3 ? (
                      <div className="flex items-center justify-center">
                        {getRankIcon(curator.rank)}
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">
                        {curator.rank}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <RandomPixelAvatar username={curator.id} size={44} />
                  </div>

                  {/* Curator Info */}
                  <div className="flex-grow min-w-0">
                    <div className="mb-3">
                      <span className="font-mono text-sm font-medium text-foreground">
                        {formatAddress(curator.id)}
                      </span>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-x-4 gap-y-2">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-0.5">
                          Score
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {formatPoints(curator.totalPoints)}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-0.5">
                          Praises
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {curator.praisesGiven}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-0.5">
                          Received
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {curator.praisesReceived}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-0.5">
                          Blessings
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {curator.blessingsGiven}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-0.5">
                          Staked
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {formatStake(curator.totalLinked)}
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-0.5">
                          Max Days
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {curator.maxStakeDays}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subtle accent for top 3 */}
                {curator.rank <= 3 && (
                  <div
                    className={`absolute inset-0 rounded-lg pointer-events-none ${
                      curator.rank === 1
                        ? "ring-1 ring-amber-500/20 bg-amber-500/5"
                        : curator.rank === 2
                        ? "ring-1 ring-slate-400/20 bg-slate-400/5"
                        : "ring-1 ring-orange-400/20 bg-orange-400/5"
                    }`}
                  />
                )}
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-8">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="min-w-32 bg-transparent"
                >
                  {loadingMore ? (
                    <>
                      <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                      Loading
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
