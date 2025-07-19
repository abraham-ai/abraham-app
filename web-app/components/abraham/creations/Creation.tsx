"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import type { CreationItem } from "@/types/abraham";
import { useAuth } from "@/context/auth-context";
import {
  useAbrahamContract,
  PRAISE_PRICE_ETHER,
} from "@/hooks/use-abraham-contract";
import BlessDialog from "./BlessDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { showErrorToast, showWarningToast } from "@/lib/error-utils";

interface Props {
  creation: CreationItem;
  onNewBlessing?: (b: {
    userAddress: string;
    message: string;
    ethUsed: string;
    blockTimestamp?: string;
  }) => void;
}

export default function Creation({ creation, onNewBlessing }: Props) {
  const { loggedIn, login, loadingAuth } = useAuth();
  const { praise } = useAbrahamContract();
  const [totalEthUsed, setTotalEthUsed] = useState(creation.ethTotal);
  const [totalPraises, setTotalPraises] = useState(creation.praiseCount);
  const [blessingsCnt, setBlessingsCnt] = useState(creation.blessingCnt);
  const [loadingPraise, setLoadingPraise] = useState(false);

  const handlePraise = async () => {
    if (!loggedIn) {
      showWarningToast(
        "Authentication Required",
        "Please log in to praise this creation."
      );
      return;
    }

    setLoadingPraise(true);
    try {
      await praise(Number(creation.id), creation.messageIndex);
      setTotalPraises((p) => p + 1);
      setTotalEthUsed((e) => e + PRAISE_PRICE_ETHER);
    } catch (error: any) {
      console.error("Praise error:", error);
      // Error toast is handled in the hook
    } finally {
      setLoadingPraise(false);
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

  return (
    <div className="grid grid-cols-12 border-b p-4 lg:w-[43vw] w-full">
      {/* avatar */}
      <Link href={`/creation/${creation.id}`} className="col-span-1 mr-3">
        <Image
          src="/abrahamlogo.png"
          alt="Abraham"
          width={100}
          height={100}
          className="rounded-full border aspect-square"
        />
      </Link>

      {/* content */}
      <div className="col-span-11 flex flex-col">
        <Link href={`/creation/${creation.id}`} className="flex flex-col pr-8">
          <p className="mb-1">{creation.description}</p>
          <Image
            src={creation.image || "/placeholder.svg"}
            alt="creation"
            width={500}
            height={300}
            className="w-full rounded-lg aspect-[5/4] object-cover mt-2 border"
            onError={(e) => {
              console.error("Image failed to load:", creation.image);
              showErrorToast(new Error("Failed to load image"), "Image Error");
            }}
          />
        </Link>

        {/* actions */}
        <div className="flex items-center mt-6 mb-4">
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="text-gray-500 hover:text-blue-500 disabled:opacity-50"
                disabled={loadingPraise}
              >
                🙌
              </button>
            </DialogTrigger>
            {loggedIn ? (
              <DialogContent className="bg-white">
                <DialogHeader>
                  <DialogTitle>Praise Creation</DialogTitle>
                  <DialogDescription>
                    Show your appreciation for this creation
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 text-gray-600">
                  <p>Cost: {PRAISE_PRICE_ETHER.toFixed(5)} ETH</p>
                  <p className="text-sm text-gray-500 mt-1">
                    This will be recorded permanently on the blockchain
                  </p>
                </div>
                <DialogFooter>
                  <Button onClick={handlePraise} disabled={loadingPraise}>
                    {loadingPraise && (
                      <Loader2Icon className="w-4 h-4 animate-spin mr-1" />
                    )}
                    {loadingPraise ? "Praising..." : "Praise"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            ) : (
              <DialogContent className="bg-white">
                <DialogHeader>
                  <DialogTitle>Authentication Required</DialogTitle>
                  <DialogDescription>
                    Connect your wallet to praise this creation.
                  </DialogDescription>
                </DialogHeader>
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
              </DialogContent>
            )}
          </Dialog>
          <span className="ml-1 text-sm font-semibold text-gray-500">
            {totalPraises}
          </span>

          {/* bless */}
          <div className="ml-10 text-gray-500">
            <BlessDialog
              creation={creation}
              blessingsCount={blessingsCnt}
              setBlessingsCount={setBlessingsCnt}
              setLocalTotalEthUsed={setTotalEthUsed}
              onNewBlessing={onNewBlessing}
            />
          </div>
          <span className="ml-1 text-sm font-semibold text-gray-500">
            {blessingsCnt}
          </span>

          {/* totals */}
          <div className="ml-10 text-sm text-gray-500">
            Total ETH: {totalEthUsed.toFixed(4)}
          </div>
        </div>
      </div>
    </div>
  );
}
