"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { CreationItem } from "@/types";
import { Loader2Icon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import BlessDialog from "./BlessDialog";
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

export default function Creation({ creation }: { creation: CreationItem }) {
  const { idToken, loggedIn, userAccounts, login, loadingAuth } = useAuth();
  const [praisesCount, setPraisesCount] = useState(creation.praises.length);
  const [burnsCount, setBurnsCount] = useState(creation.burns.length);
  const [loadingPraise, setLoadingPraise] = useState(false);
  const [loadingBurn, setLoadingBurn] = useState(false);
  const [blessingsCount, setBlessingsCount] = useState(
    creation.blessings.length
  );
  const [hasPraised, setHasPraised] = useState(
    creation.praises.includes(userAccounts || "")
  );
  const [hasBurned, setHasBurned] = useState(
    creation.burns.includes(userAccounts || "")
  );
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);

  const { praiseCreation, mannaBalance, getMannaBalance } =
    useMannaTransactions();

  useEffect(() => {
    getMannaBalance();
  }, [getMannaBalance]);

  const handlePraiseClick = async () => {
    setLoadingPraise(true);
    if (!loggedIn) {
      setIsLoginDialogOpen(true);
      setLoadingPraise(false);
      return;
    }
    try {
      // Dynamically determined praise price fetched from the contract
      const creationId = parseInt(creation._id, 10);
      await praiseCreation(creationId);
      setPraisesCount((prev) => prev + 1);
      setHasPraised(true);
      await getMannaBalance();
    } catch (error) {
      console.error("Error praising the creation:", error);
      alert("Failed to praise the creation. Please try again.");
    } finally {
      setLoadingPraise(false);
    }
  };

  // const handleBurnClick = async () => {
  //   setLoadingBurn(true);
  //   if (!loggedIn) {
  //     setIsLoginDialogOpen(true);
  //     setLoadingBurn(false);
  //     return;
  //   }
  //   try {
  //     const creationId = parseInt(creation._id, 10);
  //     await burnCreation(creationId);
  //     setBurnsCount((prev) => prev + 1);
  //     setHasBurned(true);
  //     await getMannaBalance();
  //   } catch (error) {
  //     console.error("Error burning the creation:", error);
  //     alert("Failed to burn the creation. Please try again.");
  //   } finally {
  //     setLoadingBurn(false);
  //   }
  // };

  return (
    <>
      <div className="grid grid-cols-12 border-b p-4 lg:w-[43vw]">
        <Link href={`/creation/${creation._id}`}>
          <div className="col-span-1 flex flex-col mr-3">
            <Image
              src={"/abrahamlogo.png"}
              alt={creation.creation.title}
              width={100}
              height={100}
              className="rounded-full aspect-[1] object-cover border"
            />
          </div>
        </Link>
        <div className="col-span-11 flex flex-col">
          <div className="flex flex-col items-center pr-8">
            <Link href={`/creation/${creation._id}`}>
              <p className="mb-1">{creation.creation.description}</p>
              <Image
                src={creation.result.output[0]?.url}
                alt={creation.creation.title}
                width={500}
                height={300}
                className="w-full rounded-lg aspect-[5/4] object-cover mt-2 border"
              />
            </Link>
          </div>
          <div className="flex items-center mt-6 mb-4">
            <button
              onClick={handlePraiseClick}
              disabled={loggedIn && hasPraised}
              className={`cursor-pointer ${
                loggedIn
                  ? hasPraised
                    ? "text-blue-500 cursor-not-allowed"
                    : "text-gray-500"
                  : "text-gray-500"
              }`}
            >
              {!loadingPraise && <p>🙌</p>}
              {loadingPraise && (
                <Loader2Icon className="w-5 h-5 animate-spin" />
              )}
            </button>
            <span
              className={`ml-1 text-sm font-semibold ${
                loggedIn && hasPraised ? "text-blue-600" : "text-gray-500"
              }`}
            >
              {praisesCount}
            </span>
            <button
              //onClick={handleBurnClick}
              disabled={loggedIn && hasBurned}
              className={`ml-10 cursor-pointer ${
                loggedIn
                  ? hasBurned
                    ? "text-red-500 cursor-not-allowed"
                    : "text-gray-500"
                  : "text-gray-500"
              }`}
            >
              {!loadingBurn && <p>🔥</p>}
              {loadingBurn && <Loader2Icon className="w-5 h-5 animate-spin" />}
            </button>
            <span
              className={`ml-1 text-sm font-semibold ${
                loggedIn && hasBurned ? "text-blue-600" : "text-gray-500"
              }`}
            >
              {burnsCount}
            </span>
            <div className="ml-10 cursor-pointer text-gray-500">
              {loggedIn ? (
                <BlessDialog
                  creation={creation}
                  blessingsCount={blessingsCount}
                  setBlessingsCount={setBlessingsCount}
                />
              ) : (
                <button
                  onClick={() => setIsLoginDialogOpen(true)}
                  className="text-gray-500"
                >
                  <p>🙏</p>
                </button>
              )}
            </div>
            <span className="ml-1 text-sm font-semibold text-gray-500">
              {blessingsCount}
            </span>
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
