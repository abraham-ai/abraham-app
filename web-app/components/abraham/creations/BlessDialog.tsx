"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/web-app/context/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import { useMannaTransactions } from "@/web-app/hooks/useMannaTransactions";
import { useAbrahamTransactions } from "@/web-app/hooks/useAbrahamTransactions";
import { CreationItem } from "@/web-app/types";
import { ethers } from "ethers";

interface BlessDialogProps {
  creation: CreationItem;
  blessingsCount: number;
  setBlessingsCount: (count: number) => void;
  setLocalTotalEthUsed: React.Dispatch<React.SetStateAction<number>>;

  // Pass in so we can reflect the new cost after reaction
  setCostToPraise: React.Dispatch<React.SetStateAction<number>>;

  // The new callback from parent to insert a new blessing into local state
  onNewBlessing?: (newBless: {
    userAddress: string;
    message: string;
    ethUsed: string;
    blockTimestamp?: string;
  }) => void;
}

function weiToEtherNumber(weiString: string) {
  return parseFloat(ethers.formatEther(BigInt(weiString || "0")));
}

// If contract's initPraisePrice is 0.0001 ETH:
const INIT_PRAISE_PRICE_ETHER = 0.0001;

export default function BlessDialog({
  creation,
  blessingsCount,
  setBlessingsCount,
  setLocalTotalEthUsed,
  setCostToPraise,
  onNewBlessing,
}: BlessDialogProps) {
  const { loggedIn, userInfo, userAccounts, login } = useAuth();
  const [blessingText, setBlessingText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { balance, getMannaBalance } = useMannaTransactions();
  const { makeReaction } = useAbrahamTransactions();

  // The base cost for praising, multiplied by 5 for blessing
  const basePraiseCostInEther = weiToEtherNumber(creation.currentPriceToPraise);
  const blessCostInEther = basePraiseCostInEther * 5;

  useEffect(() => {
    getMannaBalance();
  }, [getMannaBalance]);

  const handleBlessSubmit = async () => {
    if (!loggedIn) {
      alert("Please log in first.");
      return;
    }
    setIsSubmitting(true);

    try {
      // Reaction call
      await makeReaction(
        parseInt(creation.creationId, 10),
        "bless",
        blessingText,
        basePraiseCostInEther // or pass blessCostInEther if makeReaction doesn't do the *5
      );

      // Locally increment bless count & total ETH used
      setBlessingsCount(blessingsCount + 1);
      setLocalTotalEthUsed((prev) => prev + blessCostInEther);

      // The contract reactionCount increments → next cost = old cost + 0.0001
      setCostToPraise((prev) => prev + INIT_PRAISE_PRICE_ETHER);

      // Insert the new blessing into the parent's array so the user sees it immediately
      // Typically, we won't know the actual on-chain blockTimestamp right now,
      // but we can store a local timestamp for approximate ordering:
      if (onNewBlessing) {
        const newBless = {
          userAddress: userAccounts || "",
          message: blessingText,
          // We'll store how much ETH was used (in Wei string) or in Ether. We'll do Wei for consistency:
          ethUsed: ethers.parseEther(blessCostInEther.toString()).toString(), // e.g. "2000000000000000" for 0.002
          blockTimestamp: Date.now().toString(), // approximate
        };
        onNewBlessing(newBless);
      }

      await getMannaBalance();
    } catch (error) {
      console.error("Error submitting blessing:", error);
      alert("Failed to bless. Please try again.");
    } finally {
      setIsSubmitting(false);
      setBlessingText("");
    }
  };

  return (
    <Dialog>
      {loggedIn ? (
        <DialogTrigger asChild>
          <p className="text-gray-500">🙏</p>
        </DialogTrigger>
      ) : (
        <p className="text-gray-300 cursor-not-allowed">🙏</p>
      )}

      <DialogContent className="sm:max-w-xl bg-white">
        <div className="grid grid-cols-12 mt-1">
          <div className="col-span-1 flex flex-col mr-3">
            <Image
              src={"/abrahamlogo.png"}
              alt={creation.title || "Creation"}
              width={100}
              height={100}
              className="rounded-full aspect-[1] object-cover border"
            />
            <div className="py-4 ml-4 border-l h-full"></div>
          </div>
          <div className="col-span-11 flex flex-col">
            <p className="text-gray-700 ">{creation.description}</p>
            <div className="py-3"></div>
          </div>
        </div>

        <div className="grid grid-cols-12">
          <div className="col-span-1 flex flex-col mr-3">
            {userInfo?.profileImage ? (
              <Image
                src={userInfo.profileImage}
                alt="user image"
                width={100}
                height={100}
                className="rounded-full aspect-[1] object-cover border"
              />
            ) : (
              <div className="rounded-full overflow-hidden">
                <RandomPixelAvatar
                  username={userAccounts || "username"}
                  size={32}
                />
              </div>
            )}
          </div>

          <div className="col-span-11 flex flex-col">
            <Textarea
              value={blessingText}
              onChange={(e) => setBlessingText(e.target.value)}
              className="w-full border-0 text-lg -mt-2 -ml-3"
              placeholder="Share a blessing or kind thought..."
            />
          </div>
        </div>

        <DialogFooter>
          {loggedIn ? (
            <Button
              type="submit"
              className="px-8"
              onClick={handleBlessSubmit}
              disabled={isSubmitting || !blessingText}
            >
              {isSubmitting ? "Blessing..." : "Bless"}
            </Button>
          ) : (
            <Button onClick={login} disabled={isSubmitting}>
              Log In
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
