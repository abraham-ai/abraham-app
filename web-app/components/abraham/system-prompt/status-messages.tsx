"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

interface StatusMessagesProps {
  dirty: boolean;
  loggedIn: boolean;
  canAfford: boolean;
  editCostEth: string;
}

export function StatusMessages({
  dirty,
  loggedIn,
  canAfford,
  editCostEth,
}: StatusMessagesProps) {
  if (dirty && loggedIn) {
    return (
      <div
        className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          canAfford
            ? "bg-green-50 text-green-700 border border-green-100"
            : "bg-red-50 text-red-700 border border-red-100"
        }`}
      >
        {canAfford ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <AlertCircle className="h-4 w-4" />
        )}
        <span>
          {canAfford
            ? `Ready to save for ${editCostEth} ETH`
            : "Insufficient balance for this edit"}
        </span>
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 text-sm">
        <AlertCircle className="h-4 w-4" />
        <span>Connect your wallet to save changes</span>
      </div>
    );
  }

  return null;
}
