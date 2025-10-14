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
        <div className="flex items-center gap-8 w-full">
          <Link href="/">
            <div className="flex items-center">
              <Image
                src={"/abrahamlogo.png"}
                width={40}
                height={40}
                className="aspect-[1] object-cover"
                alt={""}
              />
            </div>
          </Link>

          <Link href="/seeds">
            <div className="flex items-center cursor-pointer">
              <p className="text-base">Seeds</p>
            </div>
          </Link>

          <Link href="/creations">
            <div className="flex items-center cursor-pointer">
              <p className="text-base">Creations</p>
            </div>
          </Link>

          <Link href="/covenant">
            <div className="flex items-center cursor-pointer">
              <p className="text-base">Covenant</p>
            </div>
          </Link>

          <div className="grow" />
          <AccountMenu />
        </div>
      </Menubar>
    </div>
  );
}
