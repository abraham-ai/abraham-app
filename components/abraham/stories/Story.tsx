import React, { useState } from "react";
import Image from "next/image";
import { StoryItem } from "@/types";
import { FlameIcon } from "lucide-react";
import PraiseIcon from "@/components/customIcons/PraiseIcon";
import { useAuth } from "@/context/AuthContext";
import BlessDialog from "./BlessDialog";
import Link from "next/link";

export default function Story({ story }: { story: StoryItem }) {
  const { idToken, loggedIn, userAccounts } = useAuth();
  const [praisesCount, setPraisesCount] = useState(story.praises.length);
  const [burnsCount, setBurnsCount] = useState(story.burns.length);
  const [blessingsCount, setBlessingsCount] = useState(story.blessings.length);
  const [hasPraised, setHasPraised] = useState(
    story.praises.includes(userAccounts) // Replace with actual user id
  );
  const [hasBurned, setHasBurned] = useState(
    story.burns.includes(userAccounts) // Replace with actual user id
  );

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
    try {
      if (hasPraised) {
        // User is unpraising
        await handleReaction("unpraise");
        setPraisesCount(praisesCount - 1);
        setHasPraised(false);
      } else {
        if (hasBurned) {
          // User had burned, need to unburn first
          await handleReaction("unburn");
          setBurnsCount(burnsCount - 1);
          setHasBurned(false);
        }
        await handleReaction("praise");
        setPraisesCount(praisesCount + 1);
        setHasPraised(true);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleBurnClick = async () => {
    try {
      if (hasBurned) {
        // User is unburning
        await handleReaction("unburn");
        setBurnsCount(burnsCount - 1);
        setHasBurned(false);
      } else {
        if (hasPraised) {
          // User had praised, need to unpraise first
          await handleReaction("unpraise");
          setPraisesCount(praisesCount - 1);
          setHasPraised(false);
        }
        await handleReaction("burn");
        setBurnsCount(burnsCount + 1);
        setHasBurned(true);
      }
    } catch (error) {
      console.error(error);
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
            disabled={!loggedIn}
            className={`cursor-pointer ${
              loggedIn
                ? hasPraised
                  ? "text-blue-500"
                  : "text-gray-500"
                : "text-gray-300 cursor-not-allowed"
            }`}
          >
            <PraiseIcon className="w-9 h-5 " />
          </button>
          <span className="ml-1 text-sm font-semibold text-gray-500">
            {praisesCount}
          </span>
          <button
            onClick={handleBurnClick}
            disabled={!loggedIn}
            className={`ml-10 cursor-pointer ${
              loggedIn
                ? hasBurned
                  ? "text-red-500"
                  : "text-gray-500"
                : "text-gray-300 cursor-not-allowed"
            }`}
          >
            <FlameIcon className="w-5 h-5" />
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
