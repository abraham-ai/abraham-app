import React from "react";
import Image from "next/image";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import { Blessing } from "@/types";

/** Utility to shorten addresses like 0x1234...ABCD. Adjust length as needed. */
function shortAddress(addr: string, frontLen: number = 6, endLen: number = 4) {
  if (!addr) return "";
  if (addr.length < frontLen + endLen) return addr;
  return addr.slice(0, frontLen) + "..." + addr.slice(-endLen);
}

export default function Blessings({ blessings }: { blessings: Blessing[] }) {
  return (
    <div className="flex flex-col items-center justify-center w-full">
      {blessings.map((blessing, index) => {
        const userAddr = blessing.user || blessing.userAddress || "";
        const displayAddr = shortAddress(userAddr);

        return (
          <div
            key={index}
            className="grid grid-cols-12 flex flex-col border-b border-gray-300 p-4 lg:w-[43vw]"
          >
            {/* Avatar */}
            <div className="col-span-1 flex flex-col mr-3">
              {/* If you have a real user profile image, replace below */}
              <div className="border rounded-full overflow-hidden w-full aspect-square">
                <RandomPixelAvatar username={userAddr} size={32} />
              </div>
            </div>

            {/* Blessing Content */}
            <div className="col-span-11 flex flex-col gap-1">
              {/* The actual blessing message */}
              <div className="text-gray-700">
                {blessing.blessing || blessing.message}
              </div>

              {/* Optionally show user address */}
              {userAddr && (
                <div className="text-sm text-gray-500">
                  <span>By: {displayAddr}</span>
                </div>
              )}

              {/* Optionally show a timestamp if your data has it */}
              {/* e.g., if you have blockTimestamp or something similar */}
              {blessing["blockTimestamp"] && (
                <div className="text-xs text-gray-400">
                  Posted at: {blessing["blockTimestamp"]}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
