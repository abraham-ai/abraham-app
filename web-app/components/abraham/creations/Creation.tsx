"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2Icon } from "lucide-react";
import { CreationItem } from "@/types/abraham";
import { useAuth } from "@/context/auth-context";
import {
  useAbrahamContract,
  PRAISE_PRICE_ETHER,
} from "@/hooks/use-abraham-contract";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { showErrorToast, showWarningToast } from "@/lib/error-utils";
import { getRelativeTime } from "@/lib/time-utils";

export default function Creation({ creation }: { creation: CreationItem }) {
  const { loggedIn } = useAuth();
  const { praise } = useAbrahamContract();

  const [praises, setPraises] = useState(creation.praiseCount);
  const [loading, setLoading] = useState(false);

  const handlePraise = async () => {
    if (!loggedIn) {
      showWarningToast("Authentication Required", "Please log in.");
      return;
    }
    if (creation.closed) return;

    setLoading(true);
    try {
      await praise(creation.id, creation.messageUuid);
      setPraises((p) => p + 1);
    } finally {
      setLoading(false);
    }
  };

  const createdAt = getRelativeTime(Number(creation.firstMessageAt) * 1000);
  const updatedAt = getRelativeTime(Number(creation.lastActivityAt) * 1000);

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
          <span className="text-xs text-gray-500">
            {updatedAt}
          </span>
        </div>
      </div>

      <div>
        <p className="mb-3">{creation.description}</p>
        {creation.image && (
          <Image
            src={creation.image}
            alt="creation"
            width={1280}
            height={1024}
            className="w-full rounded-lg border"
            quality={100}
            onError={() => showErrorToast(new Error("image"), "Image Error")}
          />
        )}
      </div>

      {/* actions */}
      <div className="flex items-center mt-3 pl-2">
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="flex items-center space-x-3 text-gray-600 hover:text-blue-500 transition-colors group relative disabled:opacity-50"
              disabled={loading || creation.closed}
            >
              <span className="text-3xl relative">
                🙌
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                  {creation.closed ? "Closed" : "Praise"}
                </span>
              </span>
              {praises > 0 && (
                <span className="text-lg font-medium">{praises}</span>
              )}
            </button>
          </DialogTrigger>
          {!creation.closed && (
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Praise Creation</DialogTitle>
                <DialogDescription>
                  {PRAISE_PRICE_ETHER.toFixed(5)} ETH will be sent
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={handlePraise} disabled={loading}>
                  {loading && (
                    <Loader2Icon className="w-4 h-4 animate-spin mr-1" />
                  )}
                  {loading ? "Praising…" : "Praise"}
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </div>
  );
}
