"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
  formatEther,
  encodeFunctionData,
} from "viem";
import { baseSepolia } from "viem/chains";
import { useAuth } from "@/context/auth-context";
import { useTxMode } from "@/context/tx-mode-context";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { AbrahamStakingAbi } from "@/lib/abis/AbrahamStaking";
import { useAbrahamToken, TOKEN_ADDRESS } from "./use-abraham-token";
import { showSuccessToast, showErrorToast } from "@/lib/error-utils";

export const STAKING_ADDRESS =
  (process.env.NEXT_PUBLIC_ABRAHAM_STAKING_ADDRESS as `0x${string}`) ??
  "0xDFF0A23e74cBA6A1B37e082FDa2e241c8271CEBb";

export function useAbrahamStaking() {
  const { eip1193Provider, authState } = useAuth();
  const { mode, isMiniApp } = useTxMode();
  const { user } = usePrivy();
  const { client: smartWalletClient } = useSmartWallets();
  const { transferAndCall, getAllowance, approve, balance, fetchBalance } =
    useAbrahamToken();

  const [stakedBalance, setStakedBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [staking, setStaking] = useState(false);
  const [unstaking, setUnstaking] = useState(false);

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

  // Fetch staked balance
  const fetchStakedBalance = useCallback(async () => {
    if (!userAddress) {
      setStakedBalance(null);
      return;
    }

    try {
      setLoading(true);
      const staked = await publicClient.readContract({
        address: STAKING_ADDRESS,
        abi: AbrahamStakingAbi,
        functionName: "stakedBalance",
        args: [userAddress],
      });

      setStakedBalance(formatEther(staked as bigint));
    } catch (error) {
      console.error("Error fetching staked balance:", error);
      setStakedBalance("0");
    } finally {
      setLoading(false);
    }
  }, [userAddress, publicClient]);

  // Auto-fetch on mount and address change
  useEffect(() => {
    fetchStakedBalance();
  }, [fetchStakedBalance]);

  // Stake tokens using transferAndCall
  const stake = useCallback(
    async (amount: bigint) => {
      if (!userAddress) {
        throw new Error("Wallet not connected");
      }

      console.log("[Staking] Stake called:", {
        amount: formatEther(amount),
        userAddress,
        balance,
        isMiniApp,
      });

      try {
        setStaking(true);

        // Check if user has enough ABRAHAM tokens
        const currentBalance = balance ? parseEther(balance) : BigInt(0);
        if (currentBalance < amount) {
          throw new Error("Insufficient ABRAHAM balance");
        }

        console.log("[Staking] Calling transferAndCall...");
        // Use transferAndCall to stake directly
        const hash = await transferAndCall(STAKING_ADDRESS, amount);
        console.log("[Staking] TransferAndCall successful:", hash);

        showSuccessToast(
          "Staking Successful",
          `Staked ${formatEther(amount)} ABRAHAM`
        );

        // Refresh staked balance
        await fetchStakedBalance();

        return hash;
      } catch (error: any) {
        console.error("[Staking] Stake error:", error);
        if (error?.message?.toLowerCase().includes("user rejected")) {
          throw error;
        }
        showErrorToast(error, "Staking failed");
        throw error;
      } finally {
        setStaking(false);
      }
    },
    [userAddress, transferAndCall, fetchStakedBalance, balance, isMiniApp]
  );

  // Unstake tokens
  const unstake = useCallback(
    async (amount: bigint) => {
      if (!walletClient || !userAddress) {
        throw new Error("Wallet not connected");
      }

      try {
        setUnstaking(true);

        // Check if user has enough staked balance
        const currentStaked = stakedBalance
          ? parseEther(stakedBalance)
          : BigInt(0);
        if (currentStaked < amount) {
          throw new Error("Insufficient staked balance");
        }

        let hash: `0x${string}`;

        // In Mini App, use provider directly (host controls chain)
        if (isMiniApp && eip1193Provider) {
          const data = encodeFunctionData({
            abi: AbrahamStakingAbi,
            functionName: "unstake",
            args: [amount],
          });
          hash = (await eip1193Provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                from: userAddress,
                to: STAKING_ADDRESS,
                data,
              },
            ],
          })) as `0x${string}`;
        } else {
          // Regular Privy wallet flow
          hash = await walletClient.writeContract({
            address: STAKING_ADDRESS,
            abi: AbrahamStakingAbi,
            functionName: "unstake",
            args: [amount],
            account: userAddress,
          });
        }

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === "success") {
          showSuccessToast(
            "Unstaking Successful",
            `Unstaked ${formatEther(amount)} ABRAHAM`
          );
          await fetchStakedBalance();
          return hash;
        } else {
          throw new Error("Transaction failed");
        }
      } catch (error: any) {
        if (error?.message?.toLowerCase().includes("user rejected")) {
          throw error;
        }
        showErrorToast(error, "Unstaking failed");
        throw error;
      } finally {
        setUnstaking(false);
      }
    },
    [walletClient, userAddress, publicClient, fetchStakedBalance, stakedBalance]
  );

  // Get available balance to unstake (same as staked balance)
  const getAvailableToUnstake = useCallback(() => {
    return stakedBalance ? parseEther(stakedBalance) : BigInt(0);
  }, [stakedBalance]);

  return {
    stakedBalance,
    loading,
    staking,
    unstaking,
    userAddress,
    fetchStakedBalance,
    stake,
    unstake,
    getAvailableToUnstake,
    stakingAddress: STAKING_ADDRESS,
  };
}
