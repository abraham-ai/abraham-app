"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { CreationItem } from "@/types";
import { Loader2Icon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useMannaTransactions } from "@/hooks/useMannaTransactions";
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
import { ethers } from "ethers";

interface CreationProps {
  creation: CreationItem;
}

export default function Creation({ creation }: CreationProps) {
  const { loggedIn, login, loadingAuth, userAccounts } = useAuth();
  const { praiseCreation, unpraiseCreation, getMannaBalance, balance } =
    useMannaTransactions();

  // Convert bigints from subgraph to user-friendly strings
  const formattedMannaUsed = ethers.formatUnits(creation.praisePool, 18);
  const formattedConviction = ethers.formatUnits(creation.conviction, 18);
  const initialPraises = parseInt(creation.totalStaked, 10);

  // -----------------------------
  // Local states
  // -----------------------------
  const [mannaUsed, setMannaUsed] = useState<string>(formattedMannaUsed); // total Manna staked on this creation
  const [conviction, setConviction] = useState<string>(formattedConviction);
  const [numberOfPraises, setNumberOfPraises] =
    useState<number>(initialPraises);

  // Track if the user has praised (for enabling the Unpraise button).
  const [currentHasPraised, setCurrentHasPraised] = useState<boolean>(false);

  // For storing the user's praise stats from subgraph
  const [userNoOfPraises, setUserNoOfPraises] = useState<number>(0);
  const [userMannaStaked, setUserMannaStaked] = useState<number>(0);

  // Loading states for praising/unpraising
  const [loadingPraise, setLoadingPraise] = useState(false);
  const [loadingUnpraise, setLoadingUnpraise] = useState(false);

  // For login prompt
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);

  // -----------------------------
  // Setup user data from subgraph
  // -----------------------------
  useEffect(() => {
    if (!loggedIn || !userAccounts || userAccounts.length === 0) {
      setCurrentHasPraised(false);
      setUserNoOfPraises(0);
      setUserMannaStaked(0);
      return;
    }

    const address = userAccounts[0].toLowerCase();

    // Find the PraiseCount for this user
    const found = creation.praises.find(
      (p: any) => p.userAddress.toLowerCase() === address
    );
    if (!found) {
      // user has not praised
      setCurrentHasPraised(false);
      setUserNoOfPraises(0);
      setUserMannaStaked(0);
    } else {
      // user has some praises
      const noOfP = parseInt(found.noOfPraises, 10);
      setUserNoOfPraises(noOfP);
      setUserMannaStaked(parseFloat(ethers.formatUnits(found.mannaStaked, 18)));
      setCurrentHasPraised(noOfP > 0);
    }
  }, [loggedIn, userAccounts, creation.praises]);

  // -----------------------------
  // Calculation: cost to praise
  // For simplicity: cost = 1 + parseFloat(mannaUsed)
  // You can adjust if your contract logic differs.
  // -----------------------------
  const costToPraise = (1 + parseFloat(mannaUsed)).toFixed(2);

  // -----------------------------
  // Praise creation
  // -----------------------------
  const handlePraiseClick = async () => {
    const costInWei = ethers.parseUnits(costToPraise, 18);

    if (!balance || ethers.parseUnits(balance.toString(), 18) < costInWei) {
      alert("Insufficient Manna balance to praise this creation.");
      return;
    }
    setLoadingPraise(true);

    if (!loggedIn) {
      setIsLoginDialogOpen(true);
      setLoadingPraise(false);
      return;
    }

    try {
      // Call the contract
      await praiseCreation(parseInt(creation.creationId, 10));

      // Update local UI
      // 1) Manna used for the creation goes up by cost
      setMannaUsed((prev) => {
        const prevWei = ethers.parseUnits(prev, 18);
        const newWei = prevWei + costInWei;
        return ethers.formatUnits(newWei, 18);
      });

      // 2) The total # of praises for the creation
      setNumberOfPraises((prev) => prev + 1);

      // 3) The user has praised at least once
      setCurrentHasPraised(true);

      // 4) The user’s # of praises + mannaStaked
      setUserNoOfPraises((prev) => prev + 1);
      setUserMannaStaked((prev) => prev + parseFloat(costToPraise));

      await getMannaBalance();
    } catch (error) {
      console.error("Error praising the creation:", error);
      alert("Failed to praise the creation. Please try again.");
    } finally {
      setLoadingPraise(false);
    }
  };

  // -----------------------------
  // Unpraise creation
  // We do a simpler assumption: minus 1 Manna from local UI
  // Adjust if your real contract logic differs.
  // -----------------------------
  const handleUnpraiseClick = async () => {
    const amount = ethers.parseUnits("1", 18); // unpraise cost is 1 Manna

    setLoadingUnpraise(true);
    if (!loggedIn) {
      setIsLoginDialogOpen(true);
      setLoadingUnpraise(false);
      return;
    }

    try {
      await unpraiseCreation(parseInt(creation.creationId, 10));

      // Update local UI
      // 1) Manna used for creation: subtract 1
      setMannaUsed((prev) => {
        const prevWei = ethers.parseUnits(prev, 18);
        const newWei = prevWei - amount;
        return newWei > BigInt(0) ? ethers.formatUnits(newWei, 18) : "0.0";
      });

      // 2) total # of praises
      setNumberOfPraises((prev) => (prev > 0 ? prev - 1 : 0));

      // 3) userNoOfPraises
      setUserNoOfPraises((prev) => (prev > 0 ? prev - 1 : 0));

      // 4) userMannaStaked
      setUserMannaStaked((prev) => (prev > 1 ? prev - 1 : 0));

      setCurrentHasPraised(false);

      await getMannaBalance();
    } catch (error) {
      console.error("Error unpraising the creation:", error);
      alert("Failed to unpraise the creation. Please try again.");
    } finally {
      setLoadingUnpraise(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-12 border-b border-x p-4 lg:w-[43vw] w-full">
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

          {/* Action row */}
          <div className="flex items-center mt-6 mb-4">
            {/* Dialogue Trigger: "🙌" button */}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  className="text-gray-500 hover:text-blue-500 transition-colors duration-200"
                  title="Open Praise Dialog"
                >
                  🙌
                </button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-[425px] bg-white">
                <DialogHeader>
                  <DialogTitle>Praise Creation</DialogTitle>
                  <DialogDescription>
                    Here you can see how many praises you already have, how much
                    Manna you staked, and the current cost to praise.
                  </DialogDescription>
                </DialogHeader>

                {/* Dialog Body */}
                <div className="grid gap-4 py-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-gray-600">
                      Your praises on this creation: {userNoOfPraises}
                    </p>
                    <p className="text-gray-600">
                      Your Manna Staked: {userMannaStaked.toFixed(2)}
                    </p>
                    <p className="text-gray-600">
                      Current cost to praise: {costToPraise} Manna
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
                    {!loadingPraise ? (
                      <>Praise 🙌</>
                    ) : (
                      <>
                        Praising{" "}
                        <Loader2Icon className="w-5 h-5 animate-spin ml-1" />
                      </>
                    )}
                  </Button>

                  {/* Unpraise Button (only if user has > 0 praises) */}
                  {currentHasPraised && userNoOfPraises > 0 && (
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
                      {!loadingUnpraise ? (
                        <p>Unpraise</p>
                      ) : (
                        <Loader2Icon className="w-5 h-5 animate-spin" />
                      )}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Display total # of praises */}
            <span className="ml-1 text-sm font-semibold text-gray-500">
              {numberOfPraises}
            </span>

            {/* Additional info: MannaUsed + Conviction */}
            <div className="ml-10 flex flex-col">
              <p className="text-sm text-gray-500">Manna Staked: {mannaUsed}</p>
              <p className="text-sm text-gray-500">Conviction: {conviction}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Login Dialog (if user tries to praise while not logged in) */}
      <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
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
    </>
  );
}
