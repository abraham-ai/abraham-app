"use client";
import React from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useBlessingQuota } from "@/hooks/use-blessing-quota";
import BlessingLimitDialog from "@/components/Gallery/BlessingLimitDialog";
import { Loader2Icon } from "lucide-react";

export type GalleryItem = {
  id: string;
  title: string;
  tagline: string;
  image: string;
  alt?: string;
  session_id?: string;
  cast_hash?: string;
  createdAt?: string;
  blessingsCount?: number;
};

export type GalleryProps = {
  items: GalleryItem[];
  className?: string;
  aspectRatio?: string; // e.g., "4 / 3"
  persistBlessings?: boolean; // if true, save to localStorage
  storageKey?: string; // localStorage key
  useNextImage?: boolean; // defaults to true if next/image import works
  basePath?: string; // base path for detail links, defaults to "/seeds"
};

// Format timestamp to human-friendly format
function formatTimestamp(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function BlessButton({
  count,
  onBless,
  isLoading,
  disabled,
}: {
  count: number;
  onBless: (e: React.MouseEvent) => void;
  isLoading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onBless}
      disabled={disabled || isLoading}
      className={`shrink-0 inline-flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs ${
        disabled || isLoading
          ? "text-gray-400 cursor-not-allowed"
          : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
      }`}
      aria-label="Bless this"
      title="Bless (like)"
    >
      {isLoading ? (
        <Loader2Icon className="h-4 w-4 animate-spin" />
      ) : (
        <span className="text-base leading-none">🙏</span>
      )}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

export default function MinimalGallery({
  items,
  className = "",
  aspectRatio = "4 / 3",
  persistBlessings = false,
  storageKey = "gallery_blessings",
  useNextImage = true,
  basePath = "/seeds",
}: GalleryProps) {
  const {
    tokensPerBless,
    windowMs,
    resetLabel,
    stakedBalance,
    fetchStakedBalance,
    allowance,
    used,
    left,
    remainingMs,
    limitOpen,
    setLimitOpen,
    bless,
  } = useBlessingQuota({ persistBlessings, storageKey });

  // Pending state per item to show spinner while tx is in-flight
  const [pendingById, setPendingById] = React.useState<Record<string, boolean>>(
    {}
  );
  // Local increments applied after on-chain success
  const [localAdds, setLocalAdds] = React.useState<Record<string, number>>({});

  return (
    <section className={`w-full ${className}`}>
      <BlessingLimitDialog
        open={limitOpen}
        onOpenChange={setLimitOpen}
        dailyUsed={used}
        dailyAllowance={allowance}
        stakedBalance={stakedBalance}
        tokensPerBless={tokensPerBless}
        resetLabel={resetLabel}
        remainingMs={remainingMs}
        onRefreshStake={() => fetchStakedBalance?.()}
      />
      <div className="grid gap-4 sm:gap-5 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 px-4">
        {items.map((item) => (
          <div key={item.id} className="min-h-[240px]">
            <article className="overflow-hidden border border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg transition-all">
              <Link href={`${basePath}/${item.session_id}`} className="block">
                <div
                  className="relative overflow-hidden"
                  style={{ aspectRatio }}
                >
                  {useNextImage ? (
                    <NextImage
                      src={item.image}
                      alt={item.alt ?? item.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      className="object-cover"
                      priority={false}
                    />
                  ) : (
                    <img
                      src={item.image}
                      alt={item.alt ?? item.title}
                      loading="lazy"
                      className="h-full w-full object-cover absolute inset-0"
                    />
                  )}
                </div>
                <div className="px-4 py-3 border-t border-gray-200">
                  <div className="mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {item.title}
                    </h3>
                    <p className="text-base text-gray-600 truncate">
                      {item.tagline}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-3">
                      {item.createdAt && (
                        <span>{formatTimestamp(item.createdAt)}</span>
                      )}
                      {item.cast_hash && (
                        <a
                          href={`https://farcaster.xyz/abraham-ai/${item.cast_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="hover:opacity-80 flex items-center"
                          title="View on Farcaster"
                        >
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 1000 1000"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <rect
                              width="1000"
                              height="1000"
                              rx="200"
                              fill="#8A63D2"
                            />
                            <path
                              d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z"
                              fill="white"
                            />
                            <path
                              d="M128.889 253.333L128.889 155.556H100L100 253.333L128.889 253.333Z"
                              fill="white"
                            />
                            <path
                              d="M900 253.333L900 155.556H871.111L871.111 253.333L900 253.333Z"
                              fill="white"
                            />
                          </svg>
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {allowance > 0 && (
                        <span className="text-xs text-gray-500">
                          {left}/{allowance} left
                        </span>
                      )}
                      <BlessButton
                        count={
                          (item.blessingsCount ?? 0) + (localAdds[item.id] ?? 0)
                        }
                        isLoading={!!pendingById[item.id]}
                        disabled={!!pendingById[item.id]}
                        onBless={async (e) => {
                          e.preventDefault();
                          if (pendingById[item.id]) return;
                          setPendingById((p) => ({ ...p, [item.id]: true }));
                          try {
                            const res = await bless(item.id, {
                              creationId: item.id,
                              sessionId: item.session_id,
                            });
                            if (res?.ok) {
                              setLocalAdds((prev) => ({
                                ...prev,
                                [item.id]: (prev[item.id] ?? 0) + 1,
                              }));
                            }
                          } finally {
                            setPendingById((p) => ({ ...p, [item.id]: false }));
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            </article>
          </div>
        ))}
      </div>
    </section>
  );
}
