"use client";

import React, { useState } from "react";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import { Blessing } from "@/types/abraham";
import { useAuth } from "@/context/auth-context";
import {
  useAbrahamContract,
  PRAISE_PRICE_ETHER,
} from "@/hooks/use-abraham-contract";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showErrorToast, showWarningToast } from "@/lib/error-utils";

const short = (a: string, f = 6, e = 4) =>
  !a ? "" : a.slice(0, f) + "…" + a.slice(-e);

export default function Blessings({ blessings }: { blessings: Blessing[] }) {
  const { loggedIn, login, loadingAuth } = useAuth();
  const { praise } = useAbrahamContract();
  // Track loading and praise count per blessing
  const [loadingPraiseIdx, setLoadingPraiseIdx] = useState<number | null>(null);
  const [praiseCounts, setPraiseCounts] = useState(() =>
    blessings.map((b) => b.praiseCount)
  );

  const handlePraise = async (idx: number, messageIdx: number) => {
    if (!loggedIn) {
      showWarningToast(
        "Authentication Required",
        "Please log in to praise this blessing."
      );
      return;
    }
    if (typeof messageIdx !== "number" || isNaN(messageIdx)) {
      showErrorToast(new Error("Invalid blessing index"), "Praise Failed");
      return;
    }
    setLoadingPraiseIdx(idx);
    try {
      // sessionId: blessing's parent creation id, messageIdx: blessing's index
      // For this, we need to pass messageIdx from the blessing object
      await praise(Number(blessings[idx].creationId), messageIdx);
      setPraiseCounts((counts) => {
        const updated = [...counts];
        updated[idx] = updated[idx] + 1;
        return updated;
      });
    } catch (error: any) {
      // Error toast handled in hook
    } finally {
      setLoadingPraiseIdx(null);
    }
  };

  const handleLogin = async () => {
    try {
      await login();
    } catch (error: any) {
      showErrorToast(error, "Login Failed");
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {blessings.map((b, i) => (
        <div
          key={i}
          className="grid grid-cols-12 border-b p-4 lg:w-[43vw] w-full"
        >
          <div className="col-span-1 mr-3 rounded-full overflow-hidden">
            <RandomPixelAvatar username={b.author} size={32} />
          </div>

          <div className="col-span-11 flex flex-col gap-1">
            <div className="text-gray-700">{b.content}</div>
            <div className="text-sm text-gray-500">By: {short(b.author)}</div>
            {b.timestamp && (
              <div className="text-xs text-gray-400">
                {new Date(parseInt(b.timestamp, 10) * 1000).toLocaleString()}
              </div>
            )}
            {/* Praise button and count */}
            <div className="flex items-center mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-blue-500 disabled:opacity-50"
                disabled={
                  loadingPraiseIdx === i ||
                  typeof b.messageIdx !== "number" ||
                  isNaN(b.messageIdx)
                }
                onClick={() =>
                  loggedIn ? handlePraise(i, b.messageIdx) : handleLogin()
                }
              >
                {loadingPraiseIdx === i ? (
                  <Loader2Icon className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  "🙌"
                )}
                {loadingPraiseIdx === i
                  ? " Praising..."
                  : loggedIn
                  ? " Praise"
                  : " Connect Wallet"}
              </Button>
              <span className="ml-2 text-sm font-semibold text-gray-500">
                {praiseCounts[i]}
              </span>
              <span className="ml-2 text-xs text-gray-400">
                {`(${PRAISE_PRICE_ETHER.toFixed(5)} ETH)`}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
