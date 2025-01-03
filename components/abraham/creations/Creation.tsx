"use client";

import React, { useState } from "react";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ethers } from "ethers";

interface CreationProps {
  creation: CreationItem;
  hasPraised: boolean;
}

export default function Creation({ creation, hasPraised }: CreationProps) {
  const { loggedIn, login, loadingAuth } = useAuth();
  console.log("Has praised:", hasPraised);

  const formattedMannaUsed = ethers.formatUnits(creation.praisePool, 18);
  const formattedConviction = ethers.formatUnits(creation.conviction, 18);
  const initialPraises = parseInt(creation.totalStaked, 10);

  const [mannaUsed, setMannaUsed] = useState<string>(formattedMannaUsed);
  const [conviction, setConviction] = useState<string>(formattedConviction);
  const [numberOfPraises, setNumberOfPraises] =
    useState<number>(initialPraises);
  const [currentHasPraised, setCurrentHasPraised] =
    useState<boolean>(hasPraised);

  const [loadingPraise, setLoadingPraise] = useState(false);
  const [loadingUnpraise, setLoadingUnpraise] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);

  const { praiseCreation, unpraiseCreation, getMannaBalance } =
    useMannaTransactions();

  const handlePraiseClick = async () => {
    setLoadingPraise(true);
    if (!loggedIn) {
      setIsLoginDialogOpen(true);
      setLoadingPraise(false);
      return;
    }
    try {
      await praiseCreation(parseInt(creation.creationId, 10));

      setMannaUsed((prev) => (parseFloat(prev) + 1).toString());
      setNumberOfPraises((prev) => prev + 1);
      setCurrentHasPraised(true);

      await getMannaBalance();
    } catch (error) {
      console.error("Error praising the creation:", error);
      alert("Failed to praise the creation. Please try again.");
    } finally {
      setLoadingPraise(false);
    }
  };

  const handleUnpraiseClick = async () => {
    setLoadingUnpraise(true);
    if (!loggedIn) {
      setIsLoginDialogOpen(true);
      setLoadingUnpraise(false);
      return;
    }
    try {
      await unpraiseCreation(parseInt(creation.creationId, 10));

      setMannaUsed((prev) => (parseFloat(prev) - 1).toString());
      setNumberOfPraises((prev) => (prev > 0 ? prev - 1 : 0));
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
          <div className="flex items-center mt-6 mb-4">
            <button
              onClick={handlePraiseClick}
              disabled={loadingPraise}
              className={`cursor-pointer ${
                loggedIn
                  ? loadingPraise
                    ? "text-blue-500 cursor-not-allowed"
                    : "text-gray-500 hover:text-blue-500"
                  : "text-gray-500"
              } transition-colors duration-200`}
            >
              {!loadingPraise ? (
                <p>🙌</p>
              ) : (
                <Loader2Icon className="w-5 h-5 animate-spin" />
              )}
            </button>
            <span className={`ml-1 text-sm font-semibold text-gray-500`}>
              {numberOfPraises}
            </span>
            {/* 
            // Removed burns-related UI elements
            <button
              //onClick={handleBurnClick}
              disabled={loggedIn && hasBurned}
              className={`ml-10 cursor-pointer ${
                loggedIn
                  ? hasBurned
                    ? "text-red-500 cursor-not-allowed"
                    : "text-gray-500 hover:text-red-500"
                  : "text-gray-500"
              } transition-colors duration-200`}
            >
              {!loadingBurn ? <p>🔥</p> : <Loader2Icon className="w-5 h-5 animate-spin" />}
            </button>
            <span
              className={`ml-1 text-sm font-semibold ${
                loggedIn && hasBurned ? "text-red-600" : "text-gray-500"
              }`}
            >
              {burnsCount}
            </span>
            */}
            {/* <div className="ml-10 cursor-pointer text-gray-500">
              {loggedIn ? (
                <BlessDialog
                  creation={creation}
                  // blessingsCount={blessingsCount} // Removed blessings-related props
                  // setBlessingsCount={setBlessingsCount}
                />
              ) : (
                <button
                  onClick={() => setIsLoginDialogOpen(true)}
                  className="text-gray-500 hover:text-blue-500 transition-colors duration-200"
                >
                  <p>🙏</p>
                </button>
              )}
            </div> */}
            {/* Removed the blessingsCount span as 'blessings' are not fetched */}
            {/* Additional Display for Manna Used and Conviction */}
            <div className="ml-10 flex flex-col">
              <p className="text-sm text-gray-500">Manna Used: {mannaUsed}</p>
              <p className="text-sm text-gray-500">Conviction: {conviction}</p>
            </div>

            {hasPraised && (
              <button
                onClick={handleUnpraiseClick}
                disabled={loadingUnpraise}
                className={`ml-10 cursor-pointer border rounded-lg px-6 py-1 ${
                  loggedIn
                    ? loadingUnpraise
                      ? "text-red-500 cursor-not-allowed"
                      : "text-gray-500 hover:text-red-500"
                    : "text-gray-500"
                } transition-colors duration-200`}
              >
                {!loadingUnpraise ? (
                  <p className="text-sm">Unpraise</p>
                ) : (
                  <Loader2Icon className="w-5 h-5 animate-spin" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Login Dialog */}
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
