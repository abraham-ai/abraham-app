"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import { useAbrahamActions } from "@/hooks/use-abraham-actions";
import { useAbrahamEligibility } from "@/hooks/use-abraham-eligibility";
import { CreationItem } from "@/types/abraham";
import { Loader2Icon } from "lucide-react";
import { showErrorToast, showWarningToast } from "@/lib/error-utils";
import { usePrivy } from "@privy-io/react-auth";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  creation: CreationItem;
  blessingsCount: number;
  setBlessingsCount: (n: number) => void;
  setLocalTotalEthUsed: React.Dispatch<React.SetStateAction<number>>;
  onNewBlessing?: (b: {
    userAddress: string;
    message: string;
    ethUsed: string;
    blockTimestamp?: string;
    messageUuid: string;
  }) => void;
}

export default function BlessDialog({
  creation,
  blessingsCount,
  setBlessingsCount,
  setLocalTotalEthUsed,
  onNewBlessing,
}: Props) {
  const { loggedIn, login, loadingAuth, authState } = useAuth();
  const { bless } = useAbrahamActions();
  const { canBless, blessMessage } = useAbrahamEligibility();
  const { user } = usePrivy();

  const smartAddr = useMemo(
    () =>
      (user?.linkedAccounts as any[])
        ?.find((a) => a?.type === "smart_wallet")
        ?.address?.toLowerCase?.(),
    [user]
  );
  const eoaAddr = authState.walletAddress?.toLowerCase();
  const userAddress = smartAddr || eoaAddr || "";

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  /* ---------------- submit ---------------- */
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
      // Queued; pins to IPFS then enqueues on-chain bless()
      // Call the bless action
      if (!creation.sessionIdRaw) {
        showWarningToast(
          "Session ID Missing",
          "Cannot bless: Session ID not available for this creation"
        );
        return;
      }

      const { msgUuid } = await bless(creation.sessionIdRaw, text.trim());

      /* optimistic UI */
      setBlessingsCount(blessingsCount + 1);
      setLocalTotalEthUsed((e) => e + 0); // No ETH used in new staking system
      onNewBlessing?.({
        userAddress,
        message: text.trim(),
        ethUsed: "0", // No ETH used in new staking system
        blockTimestamp: Math.floor(Date.now() / 1000).toString(),
        messageUuid: msgUuid,
      });

      setOpen(false);
      setText("");
    } catch (e) {
      // toast handled in hook
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => login().catch((e) => showErrorToast(e, "Login"));

  /* ---------------- UI ---------------- */
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center space-x-2 text-gray-600 hover:text-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading || !canBless}
              >
                <span className="text-2xl">🙏</span>
              </button>
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
      </DialogTrigger>

      <DialogContent className="bg-white">
        <DialogHeader>
          <div className="flex items-center mb-2">
            <Image
              src="/abrahamlogo.png"
              alt="avatar"
              width={40}
              height={40}
              className="rounded-full border mr-3"
            />
            <div>
              <DialogTitle>Bless Creation</DialogTitle>
              <DialogDescription>Share something kind</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loggedIn ? (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Your blessing…"
              className="min-h-[100px]"
              maxLength={500}
            />
            <p className="text-sm text-gray-500 mt-3">
              Requires staked ABRAHAM tokens
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        onClick={submit}
                        disabled={loading || !text.trim() || !canBless}
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
            </DialogFooter>
          </>
        ) : (
          <>
            <p className="py-4 text-gray-600">
              Connect your wallet to post a blessing.
            </p>
            <DialogFooter>
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
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
