"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import { Loader2Icon } from "lucide-react";
import { CreationItem } from "@/types/abraham";
import { useAuth } from "@/context/auth-context";
import { useAbrahamActions } from "@/hooks/use-abraham-actions";
import { Button } from "@/components/ui/button";
import { showErrorToast, showWarningToast } from "@/lib/error-utils";
import { getRelativeTime } from "@/lib/time-utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const OWNER = (process.env.NEXT_PUBLIC_OWNER_ADDRESS || "").toLowerCase();

export default function Creation({ creation }: { creation: CreationItem }) {
  const { loggedIn } = useAuth();
  const { praise } = useAbrahamActions();

  // keep praises in sync with props in case the page re-fetches
  const [praises, setPraises] = useState(creation.praiseCount);
  useEffect(() => setPraises(creation.praiseCount), [creation.praiseCount]);

  const [loading, setLoading] = useState(false);

  const handlePraise = async () => {
    if (!loggedIn) {
      showWarningToast("Authentication Required", "Please log in.");
      return;
    }
    if (creation.closed) return;

    setLoading(true);
    try {
      // Queues into a batched user operation (single approval for many actions)
      await praise(creation.id, creation.messageUuid);
      setPraises((p) => p + 1);
    } catch (e) {
      // toast handled inside the hook for non-reject errors
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createdAt = getRelativeTime(Number(creation.firstMessageAt) * 1000);
  const updatedAt = getRelativeTime(Number(creation.lastActivityAt) * 1000);
  const messageTime = creation.timestamp
    ? getRelativeTime(Number(creation.timestamp) * 1000)
    : updatedAt;

  const imageUrl =
    creation.image && creation.image.startsWith("ipfs://")
      ? creation.image.replace(
          /^ipfs:\/\//,
          "https://gateway.pinata.cloud/ipfs/"
        )
      : creation.image || "";

  /**
   * Count only the blessings that belong to THIS Abraham message:
   *  - find index of current messageUuid
   *  - iterate forward until the next OWNER message
   *  - count non-OWNER messages in that window
   */
  const blessingsForThisUpdate = useMemo(() => {
    if (!creation.messages?.length || !OWNER) return 0;

    const msgs = creation.messages;
    const idx = msgs.findIndex((m) => m.uuid === creation.messageUuid);
    if (idx === -1) return 0;

    let count = 0;
    for (let i = idx + 1; i < msgs.length; i++) {
      const m = msgs[i];
      const isOwner = m.author.toLowerCase() === OWNER;
      if (isOwner) break; // next Abraham update starts; stop here
      count++; // blessing (user-authored)
    }
    return count;
  }, [creation.messages, creation.messageUuid]);

  // Display “🙌” as praises + blessings attached to this update
  const displayReactions = praises + blessingsForThisUpdate;

  return (
    <div className="border-b p-4 lg:w-[43vw] w-full">
      <div className="flex items-center mb-3">
        <div className="mr-3">
          <Image
            src="/abrahamlogo.png"
            alt="avatar"
            width={40}
            height={40}
            className="rounded-full border"
          />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold">Abraham</span>
          <span className="text-xs text-gray-500">{messageTime}</span>
        </div>
      </div>

      {creation.description && <p className="mb-3">{creation.description}</p>}

      {imageUrl && (
        <Image
          src={imageUrl || "/placeholder.svg"}
          alt="creation"
          width={1280}
          height={1024}
          className="w-full rounded-lg border"
          quality={75}
          onError={() => showErrorToast(new Error("image"), "Image Error")}
        />
      )}

      {/* actions */}
      {(!creation.closed || displayReactions > 0) && (
        <div className="flex items-center mt-3 pl-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center space-x-3 text-gray-600 hover:text-blue-500 transition-colors group relative disabled:opacity-50"
                  disabled={loading || creation.closed}
                  onClick={!creation.closed ? handlePraise : undefined}
                >
                  {loading ? (
                    <Loader2Icon className="w-6 h-6 animate-spin" />
                  ) : (
                    <span className="text-3xl relative">🙌</span>
                  )}
                  {displayReactions > 0 && (
                    <span className="text-lg font-medium">
                      {displayReactions}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-gray-800 text-white border-gray-700"
              >
                {creation.closed ? (
                  <div>Closed</div>
                ) : (
                  <div>
                    <div className="font-medium">Praise Creation</div>
                    <div className="text-xs">
                      Requires staked ABRAHAM tokens
                    </div>
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
