"use client";
import { Menubar, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import { Sparkles } from "lucide-react";
import AccountMenu from "@/components/account/AccountMenu";
import Link from "next/link";
import Image from "next/image";
import { FaDiscord, FaXTwitter } from "react-icons/fa6";

export default function AppBar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-10 p-2 bg-white border-b">
      <Menubar className="rounded-none border-none px-2 lg:px-4">
        <MenubarMenu>
          <div className=" lg:hidden"></div>
          <MenubarTrigger>
            <Link href="/">
              <div className="flex">
                <Image
                  src={"/abrahamlogo.png"}
                  width={40}
                  height={40}
                  className="aspect-[1] object-cover"
                  alt={""}
                />
              </div>
            </Link>
          </MenubarTrigger>
        </MenubarMenu>

        <div className="flex items-center gap-8">
          <Link href="/creations">
            <div className="flex items-center cursor-pointer">
              <p className="text-base">Creation</p>
            </div>
          </Link>

          {/* <Link href="/leaderboard">
            <div className="flex items-center cursor-pointer">
              <p className="text-base">Curatorboard</p>
            </div>
          </Link> */}

          <Link href="/covenant">
            <div className="flex items-center cursor-pointer">
              <p className="text-base">Covenant</p>
            </div>
          </Link>

          <Link
            href="https://twitter.com/abraham_ai_"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center hover:text-gray-900 text-gray-600 transition-colors"
          >
            <FaXTwitter size={20} />
          </Link>

          <Link
            href="https://discord.gg/g8yG9bWH"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center hover:text-gray-900 text-gray-600 transition-colors"
          >
            <FaDiscord size={20} />
          </Link>
        </div>

        <div className="grow" />
        <AccountMenu />
      </Menubar>
    </div>
  );
}
