"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2Icon, CoinsIcon } from "lucide-react";
import { useWallets } from "@privy-io/react-auth"; // Import useWallets
import { baseSepolia } from "viem/chains";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import { ServerWalletPanel } from "@/components/account/ServerWalletPanel";

import { useAuth } from "@/context/auth-context";
//import { useManna } from "@/context/MannaContext";
//import { GetMannaDialog } from "@/components/account/GetMannaDialog";

function AccountMenu() {
  const { login, logout, loggedIn, loadingAuth, authState } = useAuth();
  const { wallets } = useWallets();
  //const { balance, getMannaBalance } = useManna();
  const [showFunding, setShowFunding] = React.useState(false);

  useEffect(() => {
    const wallet = wallets[0];
    if (wallet && wallet.chainId !== `eip155:${baseSepolia.id}`) {
      wallet.switchChain(baseSepolia.id);
    }
  }, [wallets]);

  if (loadingAuth) {
    return (
      <div className="m-3 flex justify-center">
        <Loader2Icon className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */

  return (
    <div className="m-3">
      {loggedIn ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="cursor-pointer">
              {authState.profileImage ? (
                <Image
                  src={authState.profileImage}
                  alt="profile"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <RandomPixelAvatar
                  username={authState.username ?? "anon"}
                  size={32}
                />
              )}
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>
              <p className="truncate">{authState.username}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setShowFunding((v) => !v);
              }}
            >
              <CoinsIcon className="w-5 h-5" />
              <span className="ml-2">Server Wallet Funding</span>
            </DropdownMenuItem>
            {showFunding && (
              <div className="mt-2 border rounded-md bg-white/50 dark:bg-neutral-900/50">
                <ServerWalletPanel />
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button onClick={login} className="px-8 rounded-lg">
          Sign in
        </Button>
      )}
    </div>
  );
}

export default AccountMenu;
