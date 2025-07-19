"use client";

import type React from "react";
import { useState } from "react";
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
import {
  useAbrahamContract,
  BLESS_PRICE_ETHER,
} from "@/hooks/use-abraham-contract";
import type { CreationItem } from "@/types/abraham";
import { ethers } from "ethers";
import { Loader2Icon } from "lucide-react";
import { showErrorToast, showWarningToast } from "@/lib/error-utils";

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
  const { bless } = useAbrahamContract();
  const { walletAddress } = authState;
  const userAddress = walletAddress?.toLowerCase();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  /* ---------------- submit ---------------- */
  const submit = async () => {
    if (!loggedIn) {
      showWarningToast(
        "Authentication Required",
        "Please connect your wallet to bless this creation."
      );
      return;
    }

    if (!text.trim()) {
      showWarningToast("Message Required", "Please enter a blessing message.");
      return;
    }

    setLoading(true);
    try {
      await bless(Number(creation.id), text.trim());

      // optimistic UI updates
      setBlessingsCount(blessingsCount + 1);
      setLocalTotalEthUsed((e) => e + BLESS_PRICE_ETHER);
      onNewBlessing?.({
        userAddress: userAddress || "",
        message: text.trim(),
        ethUsed: ethers.parseEther(BLESS_PRICE_ETHER.toString()).toString(),
        blockTimestamp: Math.floor(Date.now() / 1000).toString(),
      });

      // Close dialog and reset form
      setIsOpen(false);
      setText("");
    } catch (error: any) {
      console.error("Blessing error:", error);
      // Error toast is handled in the hook
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      await login();
    } catch (error: any) {
      console.error("Login error:", error);
      showErrorToast(error, "Login Failed");
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          className="cursor-pointer hover:scale-110 transition-transform"
          disabled={loading}
        >
          🙏
        </button>
      </DialogTrigger>
      <DialogContent className="bg-white">
        <DialogHeader>
          <div className="flex items-center mb-2">
            <Image
              src="/abrahamlogo.png"
              alt="abraham"
              width={40}
              height={40}
              className="rounded-full border mr-3"
            />
            <div>
              <DialogTitle>Bless Creation</DialogTitle>
              <DialogDescription>
                Share a blessing or kind thought
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loggedIn ? (
          <>
            <div className="space-y-4">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Share a blessing or kind thought…"
                className="min-h-[100px]"
                maxLength={500}
              />
              <div className="text-sm text-gray-500">
                <p>Cost: {BLESS_PRICE_ETHER} ETH</p>
                <p className="text-xs">
                  Your blessing will be permanently recorded on the blockchain
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={loading || !text.trim()}>
                {loading ? (
                  <>
                    <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                    Blessing...
                  </>
                ) : (
                  `Bless (${BLESS_PRICE_ETHER} ETH)`
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="py-4">
              <p className="text-gray-600">
                Connect your wallet to bless this creation and support the
                artist.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleLogin} disabled={loadingAuth}>
                {loadingAuth ? (
                  <>
                    <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                    Connecting...
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
