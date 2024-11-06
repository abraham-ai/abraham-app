"use client";
import React, { useState, useEffect } from "react";
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
import { useMannaTransactions } from "@/hooks/useMannaTransactions"; // Import the custom hook
import { formatUnits } from "viem";

function AccountMenu() {
  const { login, logout, loggedIn, userInfo, userAccounts, loadingAuth } =
    useAuth();

  const { balance, buyManna, getMannaBalance } = useMannaTransactions(); // Use the custom hook

  const [etherAmount, setEtherAmount] = useState("0.01"); // State to hold the amount of Ether to spend
  const [formattedBalance, setFormattedBalance] = useState<string>("0");

  // Format the balance for display
  useEffect(() => {
    if (balance) {
      const formatted = formatUnits(BigInt(balance), 18); // Assuming 18 decimals
      setFormattedBalance(formatted);
    }
  }, [balance]);

  const handleBuyManna = async () => {
    if (
      !etherAmount ||
      isNaN(Number(etherAmount)) ||
      Number(etherAmount) <= 0
    ) {
      alert("Please enter a valid Ether amount.");
      return;
    }
    try {
      await buyManna(etherAmount);
      await getMannaBalance(); // Refresh the balance after buying
      setEtherAmount("0.01"); // Reset the input field
      alert("Successfully purchased Manna tokens!");
    } catch (error) {
      console.error("Error buying Manna:", error);
      alert("Transaction failed. Please try again.");
    }
  };

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
              <DropdownMenuItem>
                <CoinsIcon className="w-5 h-5" />
                <p className="ml-2 text-base">{formattedBalance}</p>
                <button
                  onClick={handleBuyManna}
                  className="border rounded-lg py-1 px-4 ml-auto"
                >
                  Get Manna
                </button>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/*
              <div className="px-4 py-2">
                <input
                  type="text"
                  value={etherAmount}
                  onChange={(e) => setEtherAmount(e.target.value)}
                  placeholder="Ether amount"
                  className="border rounded w-full px-2 py-1 mb-2 text-black"
                />
              </div>
              <DropdownMenuSeparator />
              */}
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
