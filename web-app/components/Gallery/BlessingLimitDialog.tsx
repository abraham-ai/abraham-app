"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { RefreshCcwIcon } from "lucide-react";

export type BlessingLimitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dailyUsed: number;
  dailyAllowance: number;
  stakedBalance?: string | null;
  tokensPerBless: number;
  onRefreshStake: () => void;
  resetLabel?: string; // e.g., "5 minutes", "day"
  remainingMs?: number; // remaining ms until reset
};

export default function BlessingLimitDialog({
  open,
  onOpenChange,
  dailyUsed,
  dailyAllowance,
  stakedBalance,
  tokensPerBless,
  onRefreshStake,
  resetLabel,
  remainingMs,
}: BlessingLimitDialogProps) {
  const stakedDisplay = Number(stakedBalance ?? "0").toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

  const timeLeft = (() => {
    if (remainingMs == null) return null;
    const total = Math.max(0, remainingMs);
    const m = Math.floor(total / 60000);
    const s = Math.floor((total % 60000) / 1000);
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return `${mm}:${ss}`;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>Daily blessing limit reached</DialogTitle>
          <DialogDescription>
            You have used {dailyUsed} of {dailyAllowance} blessings in this
            period. Stake more ABRAHAM to increase your limit, or try again
            after the limit resets {resetLabel ? ` in ${resetLabel}` : "."}
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Staked: {stakedDisplay} ABRAHAM</p>
          <p>
            Policy: 1 blessing per {tokensPerBless.toLocaleString()} ABRAHAM
            staked every {resetLabel ?? "day"}
          </p>
          {timeLeft && (
            <p>
              Time to reset: <span className="font-medium">{timeLeft}</span>
            </p>
          )}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onRefreshStake}
            className="px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-black"
          >
            <RefreshCcwIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
