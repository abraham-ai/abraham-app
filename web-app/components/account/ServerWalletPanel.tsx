"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { useServerWallet } from "@/hooks/use-server-wallet";
import { useServerAbraham } from "@/hooks/use-server-abraham";
import { useAuth } from "@/context/auth-context";
import { Copy, RefreshCcw, Sparkles, HandHeart } from "lucide-react";

interface Props {
  onClose?: () => void;
}

export const ServerWalletPanel: React.FC<Props> = ({ onClose }) => {
  const { loggedIn, login, authState } = useAuth();
  const { address, balance, loading, error, refresh } = useServerWallet(20000);
  const { praise, bless, praiseState, blessState } = useServerAbraham();

  const copy = () => {
    if (address) navigator.clipboard.writeText(address).catch(() => {});
  };

  return (
    <div className="p-4 text-sm space-y-3">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold">Server Wallet</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        )}
      </div>

      {!loggedIn && (
        <Button size="sm" onClick={login} variant="outline">
          Sign in to create wallet
        </Button>
      )}

      {loggedIn && (
        <div className="space-y-2">
          <div className="truncate">
            <span className="font-medium">User:</span> {authState.username}
          </div>
          <div className="truncate flex items-center gap-1">
            <span className="font-medium">Address:</span>{" "}
            {address || "(fetching...)"}
            {address && (
              <button
                onClick={copy}
                className="p-1 hover:bg-gray-200 rounded transition"
                title="Copy address"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>
          <div>
            <span className="font-medium">Balance:</span>{" "}
            {balance ? `${balance} ETH` : "-"}
          </div>
          {error && <div className="text-red-600 text-xs">{error}</div>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCcw className="w-3 h-3 mr-1" /> Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => praise("demo-session", "demo-message")}
              disabled={praiseState.loading || !address}
            >
              <HandHeart className="w-3 h-3 mr-1" /> Praise
            </Button>
            <Button
              size="sm"
              onClick={() => bless("demo-session", "demo-message", "demo-cid")}
              disabled={blessState.loading || !address}
            >
              <Sparkles className="w-3 h-3 mr-1" /> Bless
            </Button>
          </div>
          {(praiseState.lastTx || blessState.lastTx) && (
            <div className="pt-1 text-[10px] break-all">
              Last Tx: {praiseState.lastTx || blessState.lastTx}
            </div>
          )}
          <p className="text-[10px] leading-relaxed text-gray-500">
            Fund with test ETH (Base Sepolia). Actions execute via a
            server-managed wallet.
          </p>
        </div>
      )}
    </div>
  );
};
