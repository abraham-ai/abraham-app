"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
  formatEther,
} from "viem";
import { baseSepolia } from "viem/chains";
import { useAuth } from "@/context/auth-context";
import { useTxMode } from "@/context/tx-mode-context";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { AbrahamTokenAbi } from "@/lib/abis/AbrahamToken";
import { showSuccessToast, showErrorToast } from "@/lib/error-utils";

export const TOKEN_ADDRESS =
  (process.env.NEXT_PUBLIC_ABRAHAM_TOKEN_ADDRESS as `0x${string}`) ??
  "0xa3189F7a118e797c91a1548C02E45F2ed5fB69a5";

export function useAbrahamToken() {
  const { eip1193Provider, authState } = useAuth();
  const { mode, isMiniApp } = useTxMode();
  const { user } = usePrivy();
  const { client: smartWalletClient } = useSmartWallets();

  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);

  // Public client for reading
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: baseSepolia,
        transport: http(baseSepolia.rpcUrls.default.http[0]),
      }),
    []
  );

  // Wallet client for writing
  const [walletClient, setWalletClient] = useState<any>(null);

  useEffect(() => {
    if (mode === "smart" && smartWalletClient) {
      setWalletClient(smartWalletClient);
    } else if (eip1193Provider) {
      setWalletClient(
        createWalletClient({
          chain: baseSepolia,
          transport: custom(eip1193Provider),
        })
      );
    }
  }, [mode, smartWalletClient, eip1193Provider]);

  // Get user address - prioritize authState in wallet mode for miniapp compatibility
  const userAddress = useMemo(() => {
    if (mode === "smart") {
      return user?.linkedAccounts?.find(
        (a) => a.type === "smart_wallet" && "address" in a
      )?.address as `0x${string}` | undefined;
    }
    // In wallet mode (including miniapp), use authState.walletAddress
    return authState.walletAddress as `0x${string}` | undefined;
  }, [mode, user, authState.walletAddress]);

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    if (!userAddress) {
      setBalance(null);
      return;
    }

    try {
      setLoading(true);
      const balanceWei = await publicClient.readContract({
        address: TOKEN_ADDRESS,
        abi: AbrahamTokenAbi,
        functionName: "balanceOf",
        args: [userAddress],
      });

      setBalance(formatEther(balanceWei as bigint));
    } catch (error) {
      console.error("Error fetching ABRAHAM balance:", error);
      setBalance("0");
    } finally {
      setLoading(false);
    }
  }, [userAddress, publicClient]);

  // Auto-fetch on mount and address change
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Get allowance for a specific spender
  const getAllowance = useCallback(
    async (spender: `0x${string}`) => {
      if (!userAddress) return BigInt(0);

      try {
        const allowance = await publicClient.readContract({
          address: TOKEN_ADDRESS,
          abi: AbrahamTokenAbi,
          functionName: "allowance",
          args: [userAddress, spender],
        });
        return allowance as bigint;
      } catch (error) {
        console.error("Error fetching allowance:", error);
        return BigInt(0);
      }
    },
    [userAddress, publicClient]
  );

  // Approve spending
  const approve = useCallback(
    async (spender: `0x${string}`, amount: bigint) => {
      if (!walletClient || !userAddress) {
        throw new Error("Wallet not connected");
      }

      try {
        setApproving(true);

        const hash = await walletClient.writeContract({
          address: TOKEN_ADDRESS,
          abi: AbrahamTokenAbi,
          functionName: "approve",
          args: [spender, amount],
          account: userAddress,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === "success") {
          showSuccessToast("Approval Successful", "Token spending approved");
          return hash;
        } else {
          throw new Error("Transaction failed");
        }
      } catch (error: any) {
        if (error?.message?.toLowerCase().includes("user rejected")) {
          // Don't show error toast for user rejections
          throw error;
        }
        showErrorToast(error, "Approval failed");
        throw error;
      } finally {
        setApproving(false);
      }
    },
    [walletClient, userAddress, publicClient]
  );

  // Transfer tokens using transferAndCall (for staking)
  const transferAndCall = useCallback(
    async (to: `0x${string}`, amount: bigint, data: `0x${string}` = "0x") => {
      if (!walletClient || !userAddress) {
        throw new Error("Wallet not connected");
      }

      try {
        const hash = await walletClient.writeContract({
          address: TOKEN_ADDRESS,
          abi: AbrahamTokenAbi,
          functionName: "transferAndCall",
          args: [to, amount, data],
          account: userAddress,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === "success") {
          await fetchBalance(); // Refresh balance
          return hash;
        } else {
          throw new Error("Transaction failed");
        }
      } catch (error: any) {
        if (error?.message?.toLowerCase().includes("user rejected")) {
          throw error;
        }
        showErrorToast(error, "Transfer failed");
        throw error;
      }
    },
    [walletClient, userAddress, publicClient, fetchBalance]
  );

  // Simple transfer tokens (for sending to other addresses)
  const transfer = useCallback(
    async (to: `0x${string}`, amountTokens: number) => {
      if (!walletClient || !userAddress) {
        throw new Error("Wallet not connected");
      }

      const amount = parseEther(amountTokens.toString());

      try {
        const hash = await walletClient.writeContract({
          address: TOKEN_ADDRESS,
          abi: AbrahamTokenAbi,
          functionName: "transfer",
          args: [to, amount],
          account: userAddress,
          chain: baseSepolia,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === "success") {
          await fetchBalance(); // Refresh balance
          return true;
        } else {
          throw new Error("Transaction failed");
        }
      } catch (error: any) {
        if (error?.message?.toLowerCase().includes("user rejected")) {
          showErrorToast(error, "Transaction cancelled by user");
          return false;
        }
        throw error;
      }
    },
    [walletClient, userAddress, publicClient, fetchBalance]
  );

  return {
    balance,
    loading,
    approving,
    userAddress,
    fetchBalance,
    getAllowance,
    approve,
    transfer,
    transferAndCall,
  };
}
