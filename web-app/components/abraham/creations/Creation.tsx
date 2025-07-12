"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { ethers } from "ethers";

import { CreationItem } from "@/types/abraham";
import { useAuth } from "@/context/AuthContext";
import { useManna } from "@/context/MannaContext";
import {
  useAbrahamContract,
  PRAISE_PRICE_ETHER,
} from "@/hooks/useAbrahamContract";
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
  const { loggedIn, login, loadingAuth, userAccounts } = useAuth();
  const { getMannaBalance } = useManna();
  const { praise } = useAbrahamContract();

  const [totalEthUsed, setTotalEthUsed] = useState(creation.ethTotal);
  const [totalPraises, setTotalPraises] = useState(creation.praiseCount);
  const [blessingsCnt, setBlessingsCnt] = useState(creation.blessingCnt);

  const [loadingPraise, setLoadingPraise] = useState(false);

  const handlePraise = async () => {
    if (!loggedIn) return alert("Please log in first.");
    setLoadingPraise(true);
    try {
      await praise(Number(creation.id), creation.messageIndex);
      setTotalPraises((p) => p + 1);
      setTotalEthUsed((e) => e + PRAISE_PRICE_ETHER);
      await getMannaBalance();
    } catch (e) {
      console.error(e);
      alert("Transaction failed or cancelled.");
    } finally {
      setLoadingPraise(false);
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
            src={creation.image}
            alt="creation"
            width={500}
            height={300}
            className="w-full rounded-lg aspect-[5/4] object-cover mt-2 border"
          />
        </Link>

        {/* actions */}
        <div className="flex items-center mt-6 mb-4">
          <Dialog>
            <DialogTrigger asChild>
              <button className="text-gray-500 hover:text-blue-500">🙌</button>
            </DialogTrigger>

            {loggedIn ? (
              <DialogContent className="bg-white">
                <DialogHeader>
                  <DialogTitle>Praise Creation</DialogTitle>
                </DialogHeader>
                <div className="py-4 text-gray-600">
                  Cost: {PRAISE_PRICE_ETHER.toFixed(5)} ETH
                </div>
                <DialogFooter>
                  <Button onClick={handlePraise} disabled={loadingPraise}>
                    {loadingPraise && (
                      <Loader2Icon className="w-4 h-4 animate-spin mr-1" />
                    )}
                    Praise
                  </Button>
                </DialogFooter>
              </DialogContent>
            ) : (
              <DialogContent className="bg-white">
                <DialogHeader>
                  <DialogTitle>Authentication Required</DialogTitle>
                  <DialogDescription>
                    Log in to perform this action.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={login} disabled={loadingAuth}>
                    {loadingAuth ? "Logging in…" : "Log in"}
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
