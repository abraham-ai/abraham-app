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

export default function BlessDialog({
  creation,
  blessingsCount,
  setBlessingsCount,
}: {
  creation: { _id: string; creation: { title: string; description: string } };
  blessingsCount: number;
  setBlessingsCount: (count: number) => void;
}) {
  const { loggedIn, userInfo, idToken, userAccounts } = useAuth();
  const [blessingText, setBlessingText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { balance, getMannaBalance } = useMannaTransactions();

  useEffect(() => {
    getMannaBalance();
  }, [getMannaBalance]);

  const handleBlessSubmit = async () => {
    if (!idToken) {
      throw new Error("User not authenticated");
    }

    setIsSubmitting(true);

    try {
      const amount = BigInt("1000000000000000000"); // 1 Manna in wei

      if (!balance || BigInt(balance) < 1) {
        alert("Insufficient Manna balance to bless this creation.");
        setIsSubmitting(false);
        return;
      }

      // Perform blockchain bless transaction
      //await blessTransaction(1, blessingText);

      // Handle server-side reaction
      const response = await fetch("/api/artlabproxy/stories/bless", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          creation_id: creation._id,
          blessing: blessingText,
          address: userAccounts,
        }),
      });

      if (response.ok) {
        setBlessingsCount(blessingsCount + 1);
        await getMannaBalance(); // Update balance after blessing
        setBlessingText(""); // Reset blessing text
      } else {
        throw new Error("Error submitting blessing");
      }
    } catch (error) {
      console.error("Error submitting blessing:", error);
      alert("Failed to bless the creation. Please try again.");
    } finally {
      setIsSubmitting(false);
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
              alt={creation.creation.title}
              width={100}
              height={100}
              className="rounded-full aspect-[1] object-cover border"
            />
            <div className="py-4 ml-4 border-l h-full"></div>
          </div>
          <div className="col-span-11 flex flex-col">
            <p className="text-gray-700 ">{creation.creation.description}</p>
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
