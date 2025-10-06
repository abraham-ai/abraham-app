"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import { useAbrahamActions } from "@/hooks/use-abraham-actions";
import { useAbrahamEligibility } from "@/hooks/use-abraham-eligibility";
import { CreationItem } from "@/types/abraham";
import { Loader2Icon } from "lucide-react";
import { showErrorToast, showWarningToast } from "@/lib/error-utils";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import { usePrivy } from "@privy-io/react-auth";
import { useTxMode } from "@/context/tx-mode-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  creation: CreationItem;
  onNewBlessing?: (b: {
    userAddress: string;
    message: string;
    ethUsed: string;
    blockTimestamp?: string;
    messageUuid: string;
  }) => void;
}

export default function BlessBox({ creation, onNewBlessing }: Props) {
  const { loggedIn, login, loadingAuth, authState, eip1193Provider } =
    useAuth();
  const { bless } = useAbrahamActions();
  const { canBless, blessMessage } = useAbrahamEligibility();
  const { user } = usePrivy();
  const { isMiniApp } = useTxMode();

  // Prefer smart wallet address for UI + attribution; fallback to EOA if any
  const smartAddr = useMemo(
    () =>
      (user?.linkedAccounts as any[])
        ?.find((a) => a?.type === "smart_wallet")
        ?.address?.toLowerCase?.(),
    [user]
  );
  const eoaAddr = authState.walletAddress?.toLowerCase();
  const userAddr = isMiniApp ? eoaAddr || "" : smartAddr || eoaAddr || "";

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  if (creation.closed) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        Session is closed – no more blessings.
      </div>
    );
  }

  const submit = async () => {
    if (!loggedIn) {
      showWarningToast("Authentication", "Please connect your wallet.");
      return;
    }
    if (!text.trim()) {
      showWarningToast("Message Required", "Enter a blessing.");
      return;
    }

    setLoading(true);
    try {
      // In Mini App, refresh the current address from the provider to avoid stale state
      let currentAddr = userAddr;
      if (isMiniApp && eip1193Provider?.request) {
        try {
          const accs: string[] = await eip1193Provider.request({
            method: "eth_accounts",
          });
          if (accs?.[0]) currentAddr = accs[0];
        } catch {}
      }
      // Queued; the hook pins to IPFS and enqueues the on-chain bless()
      if (!creation.sessionIdRaw) {
        showWarningToast(
          "Session ID Missing",
          "Cannot bless: Session ID not available for this creation"
        );
        return;
      }

      const { msgUuid } = await bless(creation.sessionIdRaw, text.trim());

      onNewBlessing?.({
        userAddress: currentAddr,
        message: text.trim(),
        ethUsed: "0", // No ETH used in new staking system
        blockTimestamp: Math.floor(Date.now() / 1000).toString(),
        messageUuid: msgUuid,
      });
      setText("");
    } catch (e) {
      // toast handled in hook for non-reject errors
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => login().catch((e) => showErrorToast(e, "Login"));

  return (
    <div className="border-t p-4 lg:w-[43vw] w-full">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {userAddr ? (
            <RandomPixelAvatar username={userAddr} size={40} />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200" />
          )}
        </div>
        <div className="flex-grow">
          {loggedIn ? (
            <>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="How should Abraham proceed?"
                className="min-h-[120px] resize-none"
                maxLength={320}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-500">
                  {text.length > 300 && `${text.length}/320 characters`}
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          onClick={submit}
                          disabled={loading || !text.trim() || !canBless}
                          size="sm"
                        >
                          {loading && (
                            <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                          )}
                          {loading ? "Blessing…" : "Bless (Requires Staking)"}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!canBless && (
                      <TooltipContent
                        side="top"
                        className="bg-gray-800 text-white border-gray-700"
                      >
                        {blessMessage}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-4 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-3">
                Connect your wallet to bless this creation
              </p>
              <Button onClick={handleLogin} disabled={loadingAuth}>
                {loadingAuth ? (
                  <>
                    <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                    Connecting…
                  </>
                ) : (
                  "Connect Wallet"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
