import React from "react";
import Image from "next/image";
import { StoryItem } from "@/types";
import { FlameIcon, MessageSquare } from "lucide-react";

export default function story({ story }: { story: StoryItem }) {
  return (
    <div className="grid grid-cols-12 border-b p-4 lg:w-[43vw]">
      <div className="col-span-1 flex flex-col mr-3">
        <Image
          src={"/abrahamlogo.png"}
          alt={story.logline}
          width={100}
          height={100}
          className="rounded-full aspect-[1] object-cover border"
        />
      </div>
      <div className="col-span-11 flex flex-col ">
        <p className="mb-1 mr-8">{story.logline}</p>
        <Image
          src={story.poster_image}
          alt={story.logline}
          width={500}
          height={500}
          className="rounded-lg aspect-[1] object-cover mt-2 border"
        />
        <div className="flex items-center mt-6 mb-4">
          <FlameIcon className="text-gray-500 w-5 h-5" />
          <span className="ml-1 text-sm font-semibold text-gray-500 ">100</span>
          <MessageSquare className="text-gray-500 w-5 h-5 ml-10" />
          <span className="ml-1 text-sm font-semibold text-gray-500">100</span>
        </div>
      </div>
    </div>
  );
}