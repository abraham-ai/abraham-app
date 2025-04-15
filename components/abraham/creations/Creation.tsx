"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { ethers } from "ethers";

import { CreationItem } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useMannaTransactions } from "@/hooks/useMannaTransactions";
import { useAbrahamTransactions } from "@/hooks/useAbrahamTransactions";
import { useManna } from "@/context/MannaContext";
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

interface CreationProps {
  creation: CreationItem;
  // NEW: callback to tell parent we have a new blessing
  onNewBlessing?: (newBless: {
    userAddress: string;
    message: string;
    ethUsed: string;
    blockTimestamp?: string;
  }) => void;
}

/** Convert wei string to Ether float */
function weiToEtherNumber(weiString: string) {
  return parseFloat(ethers.formatEther(BigInt(weiString || "0")));
}

// If your contract's initPraisePrice is 0.0001 ETH:
const INIT_PRAISE_PRICE_ETHER = 0.0001;

export default function Creation({ creation, onNewBlessing }: CreationProps) {
  const { loggedIn, login, loadingAuth, userAccounts } = useAuth();
  const { getMannaBalance } = useManna();
  const { balance } = useMannaTransactions(); // Manna if needed
  const { makeReaction } = useAbrahamTransactions();

  // 1) Convert from Wei to Ether
  const initialTotalEthUsed = weiToEtherNumber(creation.totalEthUsed);
  const initialCostToPraise = weiToEtherNumber(creation.currentPriceToPraise);

  // 2) Parse integer counters
  const creationPraiseCount =
    parseInt(creation.praiseCount.toString(), 10) || 0;
  const creationBurnCount = parseInt(creation.burnCount.toString(), 10) || 0;
  const creationBlessCount = parseInt(creation.blessCount.toString(), 10) || 0;

  // 3) Identify user’s existing data
  const userAddress = userAccounts?.toLowerCase() || "";
  const userPraiseData = creation.praises?.find(
    (p) => p.userAddress.toLowerCase() === userAddress
  );
  const initialUserNoOfPraises = userPraiseData
    ? parseInt(userPraiseData.noOfPraises.toString(), 10)
    : 0;
  const initialUserEthUsed = userPraiseData
    ? weiToEtherNumber(userPraiseData.ethUsed)
    : 0;

  // 4) Local states
  const [localTotalEthUsed, setLocalTotalEthUsed] =
    useState(initialTotalEthUsed);
  const [costToPraise, setCostToPraise] = useState(initialCostToPraise);

  const [totalPraises, setTotalPraises] = useState(creationPraiseCount);
  const [userNoOfPraises, setUserNoOfPraises] = useState(
    initialUserNoOfPraises
  );
  const [userEthUsed, setUserEthUsed] = useState(initialUserEthUsed);

  const [blessingsCount, setBlessingsCount] = useState(creationBlessCount);
  const [burnsCount, setBurnsCount] = useState(creationBurnCount);

  const [loadingPraise, setLoadingPraise] = useState(false);

  // 5) Re-sync local states if creation changes
  useEffect(() => {
    setLocalTotalEthUsed(initialTotalEthUsed);
    setCostToPraise(initialCostToPraise);

    setTotalPraises(creationPraiseCount);
    setBlessingsCount(creationBlessCount);
    setBurnsCount(creationBurnCount);

    if (userPraiseData) {
      const newPraises = parseInt(userPraiseData.noOfPraises.toString(), 10);
      setUserNoOfPraises(isNaN(newPraises) ? 0 : newPraises);
      setUserEthUsed(weiToEtherNumber(userPraiseData.ethUsed));
    } else {
      setUserNoOfPraises(0);
      setUserEthUsed(0);
    }
  }, [
    creation,
    initialTotalEthUsed,
    initialCostToPraise,
    creationPraiseCount,
    creationBlessCount,
    creationBurnCount,
    userPraiseData,
  ]);

  // ============= Praise =============
  const handlePraiseClick = async () => {
    if (!loggedIn) {
      alert("Please log in first.");
      return;
    }
    setLoadingPraise(true);

    try {
      await makeReaction(
        parseInt(creation.creationId, 10),
        "praise",
        "",
        costToPraise
      );

      // Locally update
      setUserNoOfPraises((prev) => prev + 1);
      setTotalPraises((prev) => prev + 1);
      setUserEthUsed((prev) => prev + costToPraise);
      setLocalTotalEthUsed((prev) => prev + costToPraise);

      // The next cost to praise is old + INIT_PRAISE_PRICE_ETHER
      setCostToPraise((prev) => prev + INIT_PRAISE_PRICE_ETHER);

      await getMannaBalance();
    } catch (error) {
      console.error("Error praising:", error);
      alert("Failed to praise or user canceled transaction.");
    } finally {
      setLoadingPraise(false);
    }
  };

  // Format
  const displayCostToPraise = costToPraise.toFixed(4);
  const displayUserEthUsed = userEthUsed.toFixed(4);
  const displayTotalEthUsed = localTotalEthUsed.toFixed(4);

  return (
    <div className="grid grid-cols-12 border-b p-4 lg:w-[43vw] w-full">
      {/* Creation Thumbnail */}
      <Link href={`/creation/${creation.creationId}`}>
        <div className="col-span-1 flex flex-col mr-3">
          <Image
            src={"/abrahamlogo.png"}
            alt={creation.title || "Creation"}
            width={100}
            height={100}
            className="rounded-full aspect-[1] object-cover border"
          />
        </div>
      </Link>

      {/* Main Content */}
      <div className="col-span-11 flex flex-col">
        {/* Description/Image */}
        <div className="flex flex-col items-center pr-8">
          <Link href={`/creation/${creation.creationId}`}>
            <p className="mb-1">
              {creation.description || "No description available."}
            </p>
            {creation.image && (
              <Image
                src={creation.image}
                alt={creation.title || "Creation Image"}
                width={500}
                height={300}
                className="w-full rounded-lg aspect-[5/4] object-cover mt-2 border"
              />
            )}
          </Link>
        </div>

        {/* Action Row */}
        <div className="flex items-center mt-6 mb-4">
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="text-gray-500 hover:text-blue-500 transition-colors duration-200"
                title="Open Praise Dialog"
              >
                🙌
              </button>
            </DialogTrigger>

            {loggedIn ? (
              <DialogContent className="sm:max-w-[425px] bg-white">
                <DialogHeader>
                  <DialogTitle>Praise Creation</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-gray-600">
                      Your praises here: {userNoOfPraises}
                    </p>
                    <p className="text-gray-600">
                      Your ETH used to praise: {displayUserEthUsed}
                    </p>
                    <p className="text-gray-600">
                      Current cost to praise: {displayCostToPraise} ETH
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    onClick={handlePraiseClick}
                    disabled={loadingPraise}
                    className={`cursor-pointer ${
                      loadingPraise ? "text-white cursor-not-allowed" : ""
                    } transition-colors duration-200`}
                  >
                    {loadingPraise ? (
                      <>
                        Praising
                        <Loader2Icon className="w-5 h-5 animate-spin ml-1" />
                      </>
                    ) : (
                      <>Praise 🙌</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            ) : (
              <DialogContent className="bg-white">
                <DialogHeader>
                  <DialogTitle>Authentication Required</DialogTitle>
                  <DialogDescription>
                    You need to log in to perform this action.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={login} disabled={loadingAuth}>
                    {loadingAuth ? "Logging in..." : "Log In"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            )}
          </Dialog>

          {/* # of praises */}
          <span className="ml-1 text-sm font-semibold text-gray-500">
            {totalPraises}
          </span>

          {/* Bless */}
          <div className="ml-10 cursor-pointer text-gray-500">
            {loggedIn ? (
              <BlessDialog
                creation={creation}
                blessingsCount={blessingsCount}
                setBlessingsCount={setBlessingsCount}
                setLocalTotalEthUsed={setLocalTotalEthUsed}
                // We pass along the callback from the parent
                onNewBlessing={onNewBlessing}
                // Also pass setCostToPraise so we can update the cost after bless
                setCostToPraise={setCostToPraise}
              />
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <p>🙏</p>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle>Authentication Required</DialogTitle>
                    <DialogDescription>
                      You need to log in to perform this action.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button onClick={login} disabled={loadingAuth}>
                      {loadingAuth ? "Logging in..." : "Log In"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <span className="ml-1 text-sm font-semibold text-gray-500">
            {blessingsCount}
          </span>

          {/* Additional Info */}
          <div className="ml-10 flex flex-col">
            <p className="text-sm text-gray-500">
              Total ETH Used: {displayTotalEthUsed}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
