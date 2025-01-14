"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { ethers } from "ethers";

import { CreationItem } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useMannaTransactions } from "@/hooks/useMannaTransactions";
import { useManna } from "@/context/MannaContext";

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
}

/** Convert a wei string to a normal decimal number. */
function weiToNumber(weiString: string): number {
  return parseFloat(ethers.formatUnits(weiString || "0", 18));
}

export default function Creation({ creation }: CreationProps) {
  const { loggedIn, login, loadingAuth, userAccounts } = useAuth();
  const { getMannaBalance } = useManna();
  const { praiseCreation, unpraiseCreation, balance } = useMannaTransactions();

  const initialTotalStaked: number = parseInt(creation.totalStaked, 10) || 0;
  const initialPraisePool: number = weiToNumber(creation.praisePool);
  const initialConviction = weiToNumber(creation.conviction);
  const initialCostToPraise: number = weiToNumber(
    creation.currentPriceToPraise.toString()
  );

  // Identify user’s praise data
  const userAddress = userAccounts?.toLowerCase() || "";
  const userPraiseData =
    creation.praises?.find(
      (p) => p.userAddress.toLowerCase() === userAddress
    ) || null;

  const initialUserMannaStaked: number = userPraiseData
    ? weiToNumber(userPraiseData.mannaStaked.toString())
    : 0;

  const initialNoOfPraises: number = parseInt(
    userPraiseData?.noOfPraises?.toString() || "0",
    10
  );

  // Local States
  const [localTotalStaked, setLocalTotalStaked] =
    useState<number>(initialTotalStaked);
  const [localPraisePool, setLocalPraisePool] =
    useState<number>(initialPraisePool);
  const [localConviction, setLocalConviction] =
    useState<number>(initialConviction);
  const [costToPraise, setCostToPraise] = useState<number>(initialCostToPraise);

  const [userNoOfPraises, setUserNoOfPraises] =
    useState<number>(initialNoOfPraises);
  const [userMannaStaked, setUserMannaStaked] = useState<number>(
    initialUserMannaStaked
  );

  // Loading states
  const [loadingPraise, setLoadingPraise] = useState(false);
  const [loadingUnpraise, setLoadingUnpraise] = useState(false);

  useEffect(() => {
    setLocalTotalStaked(parseInt(creation.totalStaked, 10) || 0);
    setLocalPraisePool(weiToNumber(creation.praisePool));
    setLocalConviction(parseFloat(creation.conviction));
    setCostToPraise(weiToNumber(creation.currentPriceToPraise.toString()));

    const updatedUserPraiseData =
      creation?.praises?.find(
        (p) => p.userAddress.toLowerCase() === userAddress
      ) || null;

    const newNoOfPraises = parseInt(
      updatedUserPraiseData?.noOfPraises?.toString() || "0",
      10
    );
    setUserNoOfPraises(newNoOfPraises);

    if (updatedUserPraiseData?.mannaStaked) {
      setUserMannaStaked(
        weiToNumber(updatedUserPraiseData.mannaStaked.toString())
      );
    } else {
      setUserMannaStaked(0);
    }
  }, [creation, userAddress]);

  const handlePraiseClick = async () => {
    if (!loggedIn) {
      alert("Please log in first.");
      return;
    }

    const userMannaBalance = parseFloat(balance?.toString() || "0");

    if (userMannaBalance < costToPraise) {
      alert("Insufficient Manna to praise this creation.");
      return;
    }

    setLoadingPraise(true);
    try {
      await praiseCreation(parseInt(creation.creationId, 10));

      // Update local states (pessimistic: only after success)
      setLocalTotalStaked((prev) => prev + 1);
      setLocalPraisePool((prev) => prev + costToPraise);
      setUserNoOfPraises((prev) => prev + 1); // e.g. 2 + 1 = 3
      setUserMannaStaked((prev) => prev + costToPraise);

      await getMannaBalance();
    } catch (error) {
      console.error("Error praising:", error);
      alert("Failed to praise or user canceled transaction.");
    } finally {
      setLoadingPraise(false);
    }
  };

  const handleUnpraiseClick = async () => {
    if (!loggedIn) {
      alert("Please log in first.");
      return;
    }

    setLoadingUnpraise(true);
    try {
      await unpraiseCreation(parseInt(creation.creationId, 10));

      // We approximate cost if we don't have exact last praise cost
      const approxLastPraiseCost = costToPraise;
      const unpraiseCost = 0.1; // from contract

      setLocalTotalStaked((prev) => (prev > 0 ? prev - 1 : 0));
      setLocalPraisePool((prev) =>
        prev > approxLastPraiseCost ? prev - approxLastPraiseCost : 0
      );
      setUserNoOfPraises((prev) => (prev > 0 ? prev - 1 : 0));
      setUserMannaStaked((prev) =>
        prev > unpraiseCost ? prev - unpraiseCost : 0
      );

      await getMannaBalance();
    } catch (error) {
      console.error("Error unpraising:", error);
      alert("Failed to unpraise or user canceled transaction.");
    } finally {
      setLoadingUnpraise(false);
    }
  };

  const displayCostToPraise = costToPraise.toFixed(1);
  const displayLocalPraisePool = localPraisePool.toFixed(1);
  const displayLocalConviction = localConviction.toFixed(1);
  const displayUserMannaStaked = userMannaStaked.toFixed(1);

  return (
    <>
      <div className="grid grid-cols-12 border-b border-x p-4 lg:w-[43vw] w-full">
        {/* Creation Thumbnail / Avatar */}
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
          {/* Content / Description */}
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
                        Your praises on this creation: {userNoOfPraises}
                      </p>
                      <p className="text-gray-600">
                        Your Manna Staked: {displayUserMannaStaked}
                      </p>
                      <p className="text-gray-600">
                        Current cost to praise: {displayCostToPraise} Manna
                      </p>
                    </div>
                  </div>

                  <DialogFooter>
                    {/* Praise Button */}
                    <Button
                      onClick={handlePraiseClick}
                      disabled={loadingPraise}
                      className={`cursor-pointer ${
                        loadingPraise
                          ? "text-white cursor-not-allowed"
                          : "hover:text-white"
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

                    {/* Unpraise Button (only if user has > 0 praises) */}
                    {userNoOfPraises > 0 && (
                      <Button
                        variant="secondary"
                        onClick={handleUnpraiseClick}
                        disabled={loadingUnpraise}
                        className={`cursor-pointer ml-4 ${
                          loadingUnpraise
                            ? "cursor-not-allowed"
                            : "hover:text-red-500"
                        } transition-colors duration-200`}
                      >
                        {loadingUnpraise ? (
                          <Loader2Icon className="w-5 h-5 animate-spin" />
                        ) : (
                          <>Unpraise</>
                        )}
                      </Button>
                    )}
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

            {/* Total # of praises (for entire creation) */}
            <span className="ml-1 text-sm font-semibold text-gray-500">
              {localTotalStaked}
            </span>

            {/* Additional info: Manna Pool + Conviction */}
            <div className="ml-10 flex flex-col">
              <p className="text-sm text-gray-500">
                Manna Staked: {displayLocalPraisePool}
              </p>
              <p className="text-sm text-gray-500">
                Conviction: {displayLocalConviction}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
