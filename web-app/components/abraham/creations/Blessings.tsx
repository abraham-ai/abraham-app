"use client";

import React from "react";
import Image from "next/image";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import { Blessing } from "@/types/abraham";

const short = (a: string, f = 6, e = 4) =>
  !a ? "" : a.slice(0, f) + "…" + a.slice(-e);

export default function Blessings({ blessings }: { blessings: Blessing[] }) {
  return (
    <div className="flex flex-col items-center w-full">
      {blessings.map((b, i) => (
        <div
          key={i}
          className="grid grid-cols-12 border-b p-4 lg:w-[43vw] w-full"
        >
          {/* avatar */}
          <div className="col-span-1 mr-3">
            <div className="border rounded-full overflow-hidden aspect-square">
              <RandomPixelAvatar username={b.author} size={32} />
            </div>
          </div>

          {/* content */}
          <div className="col-span-11 flex flex-col gap-1">
            <div className="text-gray-700">{b.content}</div>
            <div className="text-sm text-gray-500">By: {short(b.author)}</div>
            {b.timestamp && (
              <div className="text-xs text-gray-400">
                {new Date(parseInt(b.timestamp, 10) * 1000).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
