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
import { useAuth } from "@/context/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import { useMannaTransactions } from "@/hooks/useMannaTransactions";
import { CreationItem } from "@/types";
import { ethers } from "ethers";

export default function BlessDialog({
  creation,
  blessingsCount,
  setBlessingsCount,
}: {
  creation: CreationItem;
  blessingsCount: number;
  setBlessingsCount: (count: number) => void;
}) {
  const { loggedIn, userInfo, idToken, userAccounts } = useAuth();
  const [blessingText, setBlessingText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { makeReaction, balance, getMannaBalance } = useMannaTransactions();

  useEffect(() => {
    getMannaBalance();
  }, [getMannaBalance]);

  /** Convert a wei string to a normal decimal number. */
  function weiToNumber(weiString: string): number {
    return parseFloat(ethers.formatUnits(weiString || "0", 18));
  }

  const handleBlessSubmit = async () => {
    setIsSubmitting(true);
    if (!loggedIn) {
      alert("Please log in first.");
      return;
    }

    const userMannaBalance = parseFloat(balance?.toString() || "0");
    const costToBless =
      weiToNumber(creation.currentPriceToPraise.toString()) * 5 || 0;
    if (userMannaBalance < costToBless) {
      alert("Insufficient Manna to praise this creation.");
      return;
    }

    try {
      await makeReaction(
        parseInt(creation.creationId, 10),
        "bless",
        blessingText
      );
      setBlessingsCount(blessingsCount + 1);

      await getMannaBalance();
    } catch (error) {
      console.error("Error submitting blessing:", error);
      alert("Failed to bless the creation. Please try again.");
    } finally {
      setIsSubmitting(false);
      setBlessingText("");
    }
  };

  return (
    <Dialog>
      {loggedIn ? (
        <DialogTrigger asChild>
          <p
            className={`${
              loggedIn ? "text-gray-500" : "text-gray-300 cursor-not-allowed"
            }`}
          >
            {" "}
            🙏{" "}
          </p>
        </DialogTrigger>
      ) : (
        <p
          className={`${
            loggedIn ? "text-gray-500" : "text-gray-300 cursor-not-allowed"
          }`}
        >
          {" "}
          🙏{" "}
        </p>
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
            <div>
              {userInfo?.profileImage ? (
                <Image
                  src={userInfo.profileImage}
                  alt={"user image"}
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
          </div>
          <div className="col-span-11 flex flex-col ">
            <Textarea
              value={blessingText}
              onChange={(e) => setBlessingText(e.target.value)}
              className="w-full border-0 text-lg -mt-2 -ml-3"
              placeholder="Share a blessing or a kind thought..."
            />
          </div>
        </div>
        <DialogFooter>
          {loggedIn && (
            <Button
              type="submit"
              className="px-8"
              onClick={handleBlessSubmit}
              disabled={isSubmitting || !blessingText}
            >
              {isSubmitting ? "Blessing..." : "Bless"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function weiToNumber(arg0: string) {
  throw new Error("Function not implemented.");
}
