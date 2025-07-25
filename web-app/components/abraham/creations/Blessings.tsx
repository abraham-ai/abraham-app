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
          className="grid grid-cols-12 border-b p-4 lg:w-[43vw] w-full"
        >
          <div className="col-span-1 mr-3 overflow-hidden">
            <RandomPixelAvatar username={b.author} size={32} />
          </div>
          <div className="col-span-11 flex flex-col gap-1">
            <div>{b.content}</div>
            <div className="text-xs text-gray-400">
              {new Date(Number(b.timestamp) * 1000).toLocaleString()}
            </div>
            <div className="flex items-center mt-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={loadingIdx === i}
                onClick={() => loginOrPraise(i)}
              >
                {loadingIdx === i ? (
                  <Loader2Icon className="w-4 h-4 animate-spin" />
                ) : (
                  "🙌"
                )}
              </Button>
              <span className="ml-2 text-sm">{counts[i]}</span>
              <span className="ml-2 text-xs text-gray-400">
                ({PRAISE_PRICE_ETHER.toFixed(5)} ETH)
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
