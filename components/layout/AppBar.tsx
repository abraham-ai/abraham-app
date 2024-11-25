"use client";
import { Menubar, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import { Sparkles } from "lucide-react";
import AccountMenu from "@/components/account/AccountMenu";
import Link from "next/link";
import Image from "next/image";

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
                  width={32}
                  height={32}
                  className="aspect-[1] object-cover"
                  alt={""}
                />
                <p className="p-1 whitespace-pre-wrap bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-center text-xl font-bold leading-none tracking-tighter text-transparent">
                  abraham.ai
                </p>
              </div>
            </Link>
          </MenubarTrigger>
        </MenubarMenu>
        <div className="grow" />
        <div className="flex">
          <AccountMenu />
        </div>
      </Menubar>
    </div>
  );
}
