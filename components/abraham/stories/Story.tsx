// Story.tsx
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { StoryItem } from "@/types";
import { FlameIcon, Loader2Icon } from "lucide-react";
import PraiseIcon from "@/components/customIcons/PraiseIcon";
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
    balance,
    getMannaBalance,
  } = useMannaTransactions();

  const [formattedBalance, setFormattedBalance] = useState<bigint>(BigInt(0));

  useEffect(() => {
    if (balance) {
      setFormattedBalance(BigInt(balance));
    }
  }, [balance]);

  const handleReaction = async (actionType: string) => {
    console.log("User accounts:", userAccounts);
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
      return;
    }
    try {
      const amount = BigInt("1000000000000000000"); // 1 Manna (assuming 18 decimals)
      if (formattedBalance < amount) {
        alert("Insufficient Manna balance to praise this story.");
        return;
      }

      if (hasPraised) {
        alert("You have already praised this story.");
      } else {
        if (hasBurned) {
          alert("You have already burned this story.");
          return;
        }
        await praiseTransaction(1, amount.toString()); //use default id for now
        await handleReaction("praise");
        setPraisesCount(praisesCount + 1);
        setHasPraised(true);
        await getMannaBalance();
        setLoadingPraise(false);
      }
    } catch (error) {
      console.error("Error praising the story:", error);
      alert("Failed to praise the story. Please try again.");
    }
  };

  const handleBurnClick = async () => {
    setLoadingBurn(true);
    if (!loggedIn) {
      alert("Please log in to burn a story.");
      return;
    }
    try {
      const amount = BigInt("1000000000000000000"); // 1 Manna
      if (formattedBalance < amount) {
        alert("Insufficient Manna balance to burn this story.");
        return;
      }

      if (hasBurned) {
        alert("You have already burned this story.");
      } else {
        if (hasPraised) {
          alert("You have already praised this story.");
          return;
        }
        await burnTransaction(1, amount.toString()); //use default id for now
        await handleReaction("burn");
        setBurnsCount(burnsCount + 1);
        setHasBurned(true);
        await getMannaBalance();
        setLoadingBurn(false);
      }
    } catch (error) {
      console.error("Error burning the story:", error);
      alert("Failed to burn the story. Please try again.");
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
        <Link href={`/story/${story.id}`}>
          <p className="mb-1 mr-8">{story.logline}</p>
          <Image
            src={story.poster_image}
            alt={story.logline}
            width={500}
            height={500}
            className="rounded-lg aspect-[1] object-cover mt-2 border"
          />
        </Link>
        <div className="flex items-center mt-6 mb-4">
          <button
            onClick={handlePraiseClick}
            disabled={!loggedIn || hasPraised}
            className={`cursor-pointer ${
              loggedIn
                ? hasPraised
                  ? "text-blue-500 cursor-not-allowed"
                  : "text-gray-500"
                : "text-gray-300 cursor-not-allowed"
            }`}
          >
            {!loadingPraise && <PraiseIcon className="w-9 h-5 " />}
            {loadingPraise && <Loader2Icon className="w-5 h-5 animate-spin" />}
          </button>
          <span className="ml-1 text-sm font-semibold text-gray-500">
            {praisesCount}
          </span>
          <button
            onClick={handleBurnClick}
            disabled={!loggedIn || hasBurned}
            className={`ml-10 cursor-pointer ${
              loggedIn
                ? hasBurned
                  ? "text-red-500 cursor-not-allowed"
                  : "text-gray-500"
                : "text-gray-300 cursor-not-allowed"
            }`}
          >
            {!loadingBurn && <FlameIcon className="w-5 h-5" />}
            {loadingBurn && <Loader2Icon className="w-5 h-5 animate-spin" />}
          </button>
          <span className="ml-1 text-sm font-semibold text-gray-500">
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
