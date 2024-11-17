// AccountMenu.tsx
"use client";

import React, { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import { Button } from "@/components/ui/button";
import { Loader2Icon, CoinsIcon } from "lucide-react";
import { useManna } from "@/context/MannaContext";
import { GetMannaDialog } from "@/components/account/GetMannaDialog";

function AccountMenu() {
  const { login, logout, loggedIn, userInfo, userAccounts, loadingAuth } =
    useAuth();

  const { balance, getMannaBalance } = useManna();

  // Fetch balance when the component mounts
  useEffect(() => {
    getMannaBalance();
  }, [getMannaBalance]);

  return (
    <div className="m-3">
      {!loadingAuth && loggedIn && (
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="cursor-pointer">
                {userInfo?.profileImage ? (
                  <Image
                    src={userInfo.profileImage}
                    alt="user image"
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="rounded-full overflow-hidden">
                    <RandomPixelAvatar
                      username={userAccounts || "username"}
                      size={32}
                    />
                  </div>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <div className="truncate w-full">
                  <p className="text-sm  text-ellipsis overflow-hidden">
                    {userInfo?.name
                      ? userInfo.name
                      : userAccounts || "username"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* Display User Balance */}
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault(); // Prevent the menu from closing
                }}
              >
                <CoinsIcon className="w-5 h-5" />
                <p className="ml-2 text-base">{balance} Manna</p>
                <GetMannaDialog />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Logout Button */}
              <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {!loadingAuth && !loggedIn && (
        <Button onClick={login} className="px-8 rounded-lg">
          Sign in
        </Button>
      )}
      {loadingAuth && (
        <div className="flex justify-center">
          <Loader2Icon className="w-6 h-6 animate-spin" />
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
