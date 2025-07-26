"use client";
import { useState } from "react";
import { Blessing } from "@/types/abraham";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import { useAuth } from "@/context/auth-context";
import {
  useAbrahamContract,
  PRAISE_PRICE_ETHER,
} from "@/hooks/use-abraham-contract";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showErrorToast, showWarningToast } from "@/lib/error-utils";
import { getRelativeTime } from "@/lib/time-utils";

export default function Blessings({ blessings }: { blessings: Blessing[] }) {
  const { loggedIn, login, loadingAuth } = useAuth();
  const { praise } = useAbrahamContract();

  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [counts, setCounts] = useState(blessings.map((b) => b.praiseCount));

  const doPraise = async (i: number) => {
    if (!loggedIn) {
      showWarningToast("Auth", "Login first");
      return;
    }
    const b = blessings[i];
    setLoadingIdx(i);
    try {
      await praise(b.creationId, b.messageUuid);
      setCounts((c) => c.map((v, idx) => (idx === i ? v + 1 : v)));
    } catch {}
    setLoadingIdx(null);
  };

  const loginOrPraise = async (i: number) =>
    loggedIn ? doPraise(i) : login().catch((e) => showErrorToast(e, "Login"));

  return (
    <div className="flex flex-col items-center w-full">
      {blessings.map((b, i) => (
        <div
          key={b.messageUuid}
          className="border-b p-4 lg:w-[43vw] w-full"
        >
          <div className="flex items-center mb-3">
            <div className="mr-3">
              <RandomPixelAvatar username={b.author} size={40} />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">{b.author.slice(0, 6)}...{b.author.slice(-4)}</span>
              <span className="text-xs text-gray-500">{getRelativeTime(Number(b.timestamp) * 1000)}</span>
            </div>
          </div>
          <div className="mb-3">{b.content}</div>
          <div className="flex items-center pl-2">
            <button
              className="flex items-center space-x-3 text-gray-600 hover:text-blue-500 transition-colors"
              disabled={loadingIdx === i}
              onClick={() => loginOrPraise(i)}
            >
              <span className="text-2xl">🙌</span>
              <span className="text-base font-medium">{counts[i]} praise{counts[i] !== 1 ? 's' : ''}</span>
            </button>
            <span className="ml-4 text-xs text-gray-400">
              ({PRAISE_PRICE_ETHER.toFixed(5)} ETH)
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
