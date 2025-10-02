"use client";

import { useState } from "react";
import { Blessing } from "@/types/abraham";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import { useAuth } from "@/context/auth-context";
import {
  useAbrahamActions,
} from "@/hooks/use-abraham-actions";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showErrorToast, showWarningToast } from "@/lib/error-utils";
import { getRelativeTime } from "@/lib/time-utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  blessings: Blessing[];
  closed?: boolean; // ⇦ NEW (default: false)
}

export default function Blessings({ blessings, closed = false }: Props) {
  const { loggedIn, login, loadingAuth } = useAuth();
  const { praise } = useAbrahamActions();

  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [counts, setCounts] = useState(() =>
    blessings.map((b) => b.praiseCount)
  );

  /* single click handler ------------------------------------------------ */
  const doPraise = async (i: number) => {
    if (!loggedIn) {
      showWarningToast("Authentication", "Please log in.");
      return;
    }
    const b = blessings[i];
    setLoadingIdx(i);
    try {
      await praise(b.creationId, b.messageUuid);
      setCounts((c) => c.map((v, idx) => (idx === i ? v + 1 : v)));
    } catch (e) {
      /* toast already handled in hook */
    } finally {
      setLoadingIdx(null);
    }
  };

  const loginOrPraise = (i: number) =>
    loggedIn ? doPraise(i) : login().catch((e) => showErrorToast(e, "Login"));

  return (
    <div className="flex flex-col items-center w-full">
      {blessings.map((b, i) => (
        <div key={b.messageUuid} className="border-b p-4 lg:w-[43vw] w-full">
          {/* header */}
          <div className="flex items-center mb-3">
            <div className="mr-3">
              <RandomPixelAvatar username={b.author} size={40} />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">
                {b.author.slice(0, 6)}…{b.author.slice(-4)}
              </span>
              <span className="text-xs text-gray-500">
                {getRelativeTime(Number(b.timestamp) * 1000)}
              </span>
            </div>
          </div>

          {/* content */}
          <p className="mb-3 whitespace-pre-wrap">{b.content}</p>

          {/* actions */}
          {/* Hide praise button for closed sessions with 0 praises */}
          {(!closed || counts[i] > 0) && (
            <div className="flex items-center pl-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center space-x-3 text-gray-600 hover:text-blue-500 transition-colors"
                      disabled={closed || loadingIdx === i}
                      onClick={() => loginOrPraise(i)}
                    >
                      {loadingIdx === i ? (
                        <Loader2Icon className="w-4 h-4 animate-spin" />
                      ) : (
                        <span className="text-2xl">🙌</span>
                      )}

                      {counts[i] > 0 && (
                        <span className="text-base font-medium">
                          {counts[i]}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-gray-800 text-white border-gray-700"
                  >
                    {closed ? (
                      <div>Closed</div>
                    ) : (
                      <div>
                        <div className="font-medium">Praise Blessing</div>
                        <div className="text-xs">
                          Requires staked ABRAHAM tokens
                        </div>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
