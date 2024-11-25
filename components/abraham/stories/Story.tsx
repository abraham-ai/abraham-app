"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { StoryItem } from "@/types";
import { Loader2Icon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import BlessDialog from "./BlessDialog";
import Link from "next/link";
import { useMannaTransactions } from "@/hooks/useMannaTransactions";

export default function Story({ story }: { story: StoryItem }) {
  const { idToken, loggedIn, userAccounts } = useAuth();
  const [praisesCount, setPraisesCount] = useState(story.praises.length);
  const [burnsCount, setBurnsCount] = useState(story.burns.length);
  const [loadingPraise, setLoadingPraise] = useState(false);
  const [loadingBurn, setLoadingBurn] = useState(false);
  const [blessingsCount, setBlessingsCount] = useState(story.blessings.length);
  const [hasPraised, setHasPraised] = useState(
    story.praises.includes(userAccounts || "")
  );
  const [hasBurned, setHasBurned] = useState(
    story.burns.includes(userAccounts || "")
  );

  const {
    praise: praiseTransaction,
    burn: burnTransaction,
    balance, // BigInt balance in wei
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
        story_id: story.id,
        action: actionType,
        address: userAccounts,
      }),
    });

    if (!response.ok) {
      throw new Error("Error reacting to story");
    }
  };

  const handlePraiseClick = async () => {
    setLoadingPraise(true);
    if (!loggedIn) {
      alert("Please log in to praise a story.");
      setLoadingPraise(false);
      return;
    }
    try {
      const amount = BigInt("1000000000000000000"); // 1 Manna in wei

      if (!balance || BigInt(balance) < 1) {
        alert("Insufficient Manna balance to praise this story.");
        setLoadingPraise(false);
        return;
      }

      await praiseTransaction(1, amount);
      await handleReaction("praise");
      setPraisesCount(praisesCount + 1);
      setHasPraised(true);
      await getMannaBalance();
    } catch (error) {
      console.error("Error praising the story:", error);
      alert("Failed to praise the story. Please try again.");
    } finally {
      setLoadingPraise(false);
    }
  };

  const handleBurnClick = async () => {
    setLoadingBurn(true);
    if (!loggedIn) {
      alert("Please log in to burn a story.");
      setLoadingBurn(false);
      return;
    }
    try {
      const amount = BigInt("1000000000000000000"); // 1 Manna in wei

      if (!balance || BigInt(balance) < 1) {
        alert("Insufficient Manna balance to burn this story.");
        setLoadingBurn(false);
        return;
      }

      await burnTransaction(1, amount);
      await handleReaction("burn");
      setBurnsCount(burnsCount + 1);
      setHasBurned(true);
      await getMannaBalance();
    } catch (error) {
      console.error("Error burning the story:", error);
      alert("Failed to burn the story. Please try again.");
    } finally {
      setLoadingBurn(false);
    }
  };

  return (
    <div className="grid grid-cols-12 border-b p-4 lg:w-[43vw]">
      <Link href={`/story/${story.id}`}>
        <div className="col-span-1 flex flex-col mr-3">
          <Image
            src={"/abrahamlogo.png"}
            alt={story.logline}
            width={100}
            height={100}
            className="rounded-full aspect-[1] object-cover border"
          />
        </div>
      </Link>
      <div className="col-span-11 flex flex-col ">
        <div className="flex flex-col items-center pr-8">
          <Link href={`/story/${story.id}`}>
            <p className="mb-1 ">{story.logline}</p>
            <Image
              src={story.poster_image}
              alt={story.logline}
              width={500}
              height={300}
              className="w-full rounded-lg aspect-[5/4] object-cover mt-2 border"
            />
          </Link>
        </div>
        <div className="flex items-center mt-6 mb-4">
          <button
            onClick={handlePraiseClick}
            disabled={!loggedIn}
            className={`cursor-pointer ${
              loggedIn
                ? hasPraised
                  ? "text-blue-500 cursor-not-allowed"
                  : "text-gray-500"
                : "text-gray-300 cursor-not-allowed"
            }`}
          >
            {!loadingPraise && <p> 🙌 </p>}
            {loadingPraise && <Loader2Icon className="w-5 h-5 animate-spin" />}
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
            disabled={!loggedIn}
            className={`ml-10 cursor-pointer ${
              loggedIn
                ? hasBurned
                  ? "text-red-500 cursor-not-allowed"
                  : "text-gray-500"
                : "text-gray-300 cursor-not-allowed"
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
            <BlessDialog
              story={story}
              blessingsCount={blessingsCount}
              setBlessingsCount={setBlessingsCount}
            />
          </div>
          <span className="ml-1 text-sm font-semibold text-gray-500">
            {blessingsCount}
          </span>
        </div>
      </div>
    </div>
  );
}
