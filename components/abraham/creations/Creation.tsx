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

  const {
    praise,
    burn,
    balance, // string formatted balance
    getMannaBalance,
  } = useMannaTransactions();

  // Fetch balance when the component mounts
  useEffect(() => {
    getMannaBalance();
  }, [getMannaBalance]);

  const handleReaction = async (actionType: string) => {
    if (!idToken) {
      throw new Error("User not authenticated");
    }

    const response = await fetch("/api/artlabproxy/stories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        creation_id: creation._id,
        action: actionType,
        address: userAccounts,
      }),
    });

    if (!response.ok) {
      throw new Error("Error reacting to creation");
    }
  };

  const handlePraiseClick = async () => {
    setLoadingPraise(true);
    if (!loggedIn) {
      setIsLoginDialogOpen(true);
      setLoadingPraise(false);
      return;
    }
    try {
      const amount = BigInt("1000000000000000000"); // 1 Manna in wei
      // balance is a string, parse it to check if user has at least 1 Manna
      if (!balance || parseFloat(balance) < 1) {
        alert("Insufficient Manna balance to praise this creation.");
        setLoadingPraise(false);
        return;
      }

      // Call praise function from hook
      await praise(1, amount); // Using creationId=1 for demo; replace with actual creation ID if needed
      await handleReaction("praise");
      setPraisesCount(praisesCount + 1);
      setHasPraised(true);
      await getMannaBalance();
    } catch (error) {
      console.error("Error praising the creation:", error);
      alert("Failed to praise the creation. Please try again.");
    } finally {
      setLoadingPraise(false);
    }
  };

  const handleBurnClick = async () => {
    setLoadingBurn(true);
    if (!loggedIn) {
      setIsLoginDialogOpen(true);
      setLoadingBurn(false);
      return;
    }
    try {
      const amount = BigInt("1000000000000000000"); // 1 Manna in wei
      if (!balance || parseFloat(balance) < 1) {
        alert("Insufficient Manna balance to burn this creation.");
        setLoadingBurn(false);
        return;
      }

      // Call burn function from hook
      await burn(1, amount); // Using creationId=1 for demo; replace with actual creation ID if needed
      await handleReaction("burn");
      setBurnsCount(burnsCount + 1);
      setHasBurned(true);
      await getMannaBalance();
    } catch (error) {
      console.error("Error burning the creation:", error);
      alert("Failed to burn the creation. Please try again.");
    } finally {
      setLoadingBurn(false);
    }
  };

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
        <div className="col-span-11 flex flex-col ">
          <div className="flex flex-col items-center pr-8">
            <Link href={`/creation/${creation._id}`}>
              <p className="mb-1 ">{creation.creation.description}</p>
              <Image
                src={creation.result.output[0]?.url || "/fallback.png"}
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
              {!loadingPraise && <p> 🙌 </p>}
              {loadingPraise && (
                <Loader2Icon className="w-5 h-5 animate-spin" />
              )}
            </button>
            <span
              className={`ml-1 text-sm font-semibold  ${
                loggedIn && hasPraised ? "text-blue-600" : "text-gray-500"
              }`}
            >
              {praisesCount}
            </span>
            <button
              onClick={handleBurnClick}
              disabled={loggedIn && hasBurned}
              className={`ml-10 cursor-pointer ${
                loggedIn
                  ? hasBurned
                    ? "text-red-500 cursor-not-allowed"
                    : "text-gray-500"
                  : "text-gray-500"
              }`}
            >
              {!loadingBurn && <p> 🔥</p>}
              {loadingBurn && <Loader2Icon className="w-5 h-5 animate-spin" />}
            </button>
            <span
              className={`ml-1 text-sm font-semibold  ${
                loggedIn && hasBurned ? "text-blue-600" : "text-gray-500"
              }`}
            >
              {burnsCount}
            </span>
            <div className={`ml-10 cursor-pointer text-gray-500`}>
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
