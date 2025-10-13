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
import { getPreferredChain } from "@/lib/chains";
import { useAuth } from "@/context/auth-context";
import { useTxMode } from "@/context/tx-mode-context";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { StakingAbi } from "@/lib/abis/Staking";
import { useAbrahamToken } from "./use-abraham-token";
import { showSuccessToast, showErrorToast } from "@/lib/error-utils";

export const STAKING_ADDRESS =
  (process.env.NEXT_PUBLIC_ABRAHAM_STAKING_ADDRESS as `0x${string}`) ??
  "0xb823C0Eec6Dc6155DE3288695eD132eC2F8e477a";

// Default locking period: 1 week (minimum required by contract)
const DEFAULT_LOCKING_PERIOD = 7 * 24 * 60 * 60; // 1 week in seconds

export function useAbrahamStaking() {
  const { eip1193Provider, authState } = useAuth();
  const { mode, isMiniApp } = useTxMode();
  const { user } = usePrivy();
  const { client: smartWalletClient } = useSmartWallets();
  const { getAllowance, approve, balance, fetchBalance } = useAbrahamToken();

  const [stakedBalance, setStakedBalance] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [staking, setStaking] = useState(false);
  const [unstaking, setUnstaking] = useState(false);

  // Public client for reading
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: getPreferredChain(),
        transport: http(getPreferredChain().rpcUrls.default.http[0]),
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
          chain: getPreferredChain(),
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

  // Fetch staked balance using getStakingInfo
  const fetchStakedBalance = useCallback(async () => {
    if (!userAddress) {
      console.log("[Staking] No user address, skipping fetch");
      setStakedBalance(null);
      setLockedUntil(null);
      return;
    }

    try {
      setLoading(true);

      console.log("[Staking] Fetching staked balance for:", userAddress);
      console.log("[Staking] Using staking address:", STAKING_ADDRESS);

      // Use getStakingInfo() to read staked amount
      const stakingInfo = await publicClient.readContract({
        address: STAKING_ADDRESS,
        abi: StakingAbi,
        functionName: "getStakingInfo",
        args: [userAddress],
      });

      console.log("[Staking] Raw stakingInfo:", stakingInfo);

      // StakingInfo struct: { stakedAmount: uint256, lockedUntil: uint256 }
      const { stakedAmount, lockedUntil: locked } = stakingInfo as {
        stakedAmount: bigint;
        lockedUntil: bigint;
      };

      console.log("[Staking] Parsed stakedAmount:", stakedAmount.toString());
      console.log("[Staking] Parsed lockedUntil:", locked.toString());
      console.log(
        "[Staking] Formatted staked balance:",
        formatEther(stakedAmount)
      );

      setStakedBalance(formatEther(stakedAmount));
      setLockedUntil(locked);
    } catch (error: any) {
      console.error("[Staking] Error fetching staked balance:", error);
      console.error("[Staking] Error details:", {
        message: error?.message,
        code: error?.code,
        data: error?.data,
      });
      setStakedBalance("0");
      setLockedUntil(null);
    } finally {
      setLoading(false);
    }
  }, [userAddress, publicClient]);

  // Auto-fetch on mount and address change
  useEffect(() => {
    fetchStakedBalance();
  }, [fetchStakedBalance]);

  // Stake tokens (proper approve + stake flow)
  const stake = useCallback(
    async (amount: bigint, lockingPeriod?: number) => {
      if (!walletClient || !userAddress) {
        throw new Error("Wallet not connected");
      }

      const period = lockingPeriod || DEFAULT_LOCKING_PERIOD;

      console.log("[Staking] Stake called:", {
        amount: formatEther(amount),
        lockingPeriod: period,
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

        // Step 1: Check allowance
        const currentAllowance = await getAllowance(STAKING_ADDRESS);
        console.log(
          "[Staking] Current allowance:",
          formatEther(currentAllowance)
        );

        // Step 2: Approve if needed
        if (currentAllowance < amount) {
          console.log("[Staking] Approving tokens...");
          await approve(STAKING_ADDRESS, amount);
          console.log("[Staking] Approval successful");
        }

        // Step 3: Stake with locking period
        console.log("[Staking] Calling stake function...");
        let hash: `0x${string}`;

        // In Mini App, use provider directly (host controls chain)
        if (isMiniApp && eip1193Provider) {
          const data = encodeFunctionData({
            abi: StakingAbi,
            functionName: "stake",
            args: [amount, period],
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
          // Pre-flight simulate the call to get revert reasons (if any)
          try {
            await publicClient.simulateContract({
              address: STAKING_ADDRESS,
              abi: StakingAbi,
              functionName: "stake",
              args: [amount, period],
              account: userAddress,
            });
          } catch (simErr: any) {
            console.error("[Staking] Simulation failed:", simErr);
            // Bubble a clearer message to the UI
            const message =
              simErr?.shortMessage || simErr?.message || String(simErr);
            throw new Error(`Pre-flight simulation failed: ${message}`);
          }

          hash = await walletClient.writeContract({
            address: STAKING_ADDRESS,
            abi: StakingAbi,
            functionName: "stake",
            args: [amount, period],
            account: userAddress,
            chain: getPreferredChain(),
          });
        }

        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === "success") {
          showSuccessToast(
            "Staking Successful",
            `Staked ${formatEther(amount)} ABRAHAM for ${Math.floor(
              period / 86400
            )} days`
          );

          // Refresh balances
          await fetchStakedBalance();
          await fetchBalance();

          return hash;
        } else {
          throw new Error("Transaction failed");
        }
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
    [
      walletClient,
      userAddress,
      publicClient,
      getAllowance,
      approve,
      fetchStakedBalance,
      fetchBalance,
      balance,
      isMiniApp,
      eip1193Provider,
    ]
  );

  // Unstake tokens (with lock period validation)
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

        // Check if tokens are still locked
        if (
          lockedUntil &&
          lockedUntil > BigInt(Math.floor(Date.now() / 1000))
        ) {
          const unlockDate = new Date(Number(lockedUntil) * 1000);
          throw new Error(
            `Tokens are locked until ${unlockDate.toLocaleString()}`
          );
        }

        let hash: `0x${string}`;

        // In Mini App, use provider directly (host controls chain)
        if (isMiniApp && eip1193Provider) {
          const data = encodeFunctionData({
            abi: StakingAbi,
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
            abi: StakingAbi,
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
          await fetchBalance();

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
    [
      walletClient,
      userAddress,
      publicClient,
      fetchStakedBalance,
      fetchBalance,
      stakedBalance,
      lockedUntil,
      isMiniApp,
      eip1193Provider,
    ]
  );

  // Get available balance to unstake (checks lock period)
  const getAvailableToUnstake = useCallback(() => {
    if (!stakedBalance) return BigInt(0);

    const staked = parseEther(stakedBalance);

    // Check if still locked
    if (lockedUntil && lockedUntil > BigInt(Math.floor(Date.now() / 1000))) {
      return BigInt(0); // Still locked
    }

    return staked;
  }, [stakedBalance, lockedUntil]);

  // Check if tokens are currently locked
  const isLocked = useCallback(() => {
    if (!lockedUntil) return false;
    return lockedUntil > BigInt(Math.floor(Date.now() / 1000));
  }, [lockedUntil]);

  // Get unlock date
  const getUnlockDate = useCallback(() => {
    if (!lockedUntil) return null;
    return new Date(Number(lockedUntil) * 1000);
  }, [lockedUntil]);

  return {
    stakedBalance,
    lockedUntil,
    loading,
    staking,
    unstaking,
    userAddress,
    fetchStakedBalance,
    stake,
    unstake,
    getAvailableToUnstake,
    isLocked,
    getUnlockDate,
    stakingAddress: STAKING_ADDRESS,
  };
}
