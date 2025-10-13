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
import { StakingAbi } from "@/lib/abis/Staking";
import { useAbrahamToken, TOKEN_ADDRESS } from "./use-abraham-token";
import { showSuccessToast, showErrorToast } from "@/lib/error-utils";

export const STAKING_ADDRESS =
  (process.env.NEXT_PUBLIC_ABRAHAM_STAKING_ADDRESS as `0x${string}`) ??
  "0xA8f867fA115f64F9728Fc4fd4Ce959f12442a86E";

export function useAbrahamStaking() {
  const { eip1193Provider, authState } = useAuth();
  const { mode, isMiniApp } = useTxMode();
  const { user } = usePrivy();
  const { client: smartWalletClient } = useSmartWallets();
  const { transferAndCall, getAllowance, approve, balance, fetchBalance } =
    useAbrahamToken();

  const [stakedBalance, setStakedBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
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

  // Ensure the connected wallet/provider is on Base Sepolia before any write
  const ensureBaseSepolia = useCallback(async () => {
    try {
      // Mini app path: use raw provider switching
      if (isMiniApp && eip1193Provider?.request) {
        const chainIdHex = (await eip1193Provider.request({
          method: "eth_chainId",
        })) as string;
        const currentId = Number(chainIdHex);
        if (currentId !== baseSepolia.id) {
          try {
            await eip1193Provider.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: `0x${baseSepolia.id.toString(16)}` }],
            });
          } catch (err: any) {
            // If chain not added, try adding
            if (err?.code === 4902) {
              await eip1193Provider.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: `0x${baseSepolia.id.toString(16)}`,
                    chainName: baseSepolia.name,
                    nativeCurrency: baseSepolia.nativeCurrency,
                    rpcUrls: baseSepolia.rpcUrls.default.http,
                    blockExplorerUrls: [
                      baseSepolia.blockExplorers?.default?.url || "",
                    ].filter(Boolean),
                  },
                ],
              });
              // retry switch
              await eip1193Provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: `0x${baseSepolia.id.toString(16)}` }],
              });
            } else {
              throw err;
            }
          }
        }
        return;
      }

      // Regular wallet clients (including Privy wallets)
      if (walletClient?.getChainId) {
        const currentId = await walletClient.getChainId();
        if (currentId !== baseSepolia.id) {
          if (walletClient?.switchChain) {
            await walletClient.switchChain({ id: baseSepolia.id });
          } else if (eip1193Provider?.request) {
            try {
              await eip1193Provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: `0x${baseSepolia.id.toString(16)}` }],
              });
            } catch (err: any) {
              if (err?.code === 4902) {
                await eip1193Provider.request({
                  method: "wallet_addEthereumChain",
                  params: [
                    {
                      chainId: `0x${baseSepolia.id.toString(16)}`,
                      chainName: baseSepolia.name,
                      nativeCurrency: baseSepolia.nativeCurrency,
                      rpcUrls: baseSepolia.rpcUrls.default.http,
                      blockExplorerUrls: [
                        baseSepolia.blockExplorers?.default?.url || "",
                      ].filter(Boolean),
                    },
                  ],
                });
                await eip1193Provider.request({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: `0x${baseSepolia.id.toString(16)}` }],
                });
              } else {
                throw err;
              }
            }
          } else {
            throw new Error("Wrong network. Please switch to Base Sepolia.");
          }
        }
      }
    } catch (err) {
      console.error("[Network] Failed to ensure Base Sepolia:", err);
      throw err;
    }
  }, [walletClient, eip1193Provider, isMiniApp]);

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

  // Fetch staked balance from the real Staking contract
  const fetchStakedBalance = useCallback(async () => {
    if (!userAddress) {
      setStakedBalance(null);
      setLockedUntil(null);
      return;
    }

    try {
      setLoading(true);
      // New contract exposes getStakingInfo(address) -> (stakedAmount, lockedUntil)
      const stakingInfo = (await publicClient.readContract({
        address: STAKING_ADDRESS,
        abi: StakingAbi,
        functionName: "getStakingInfo",
        args: [userAddress],
      })) as { stakedAmount: bigint; lockedUntil: bigint };

      const amount = stakingInfo?.stakedAmount ?? BigInt(0);
      const locked = stakingInfo?.lockedUntil ?? BigInt(0);
      setStakedBalance(formatEther(amount));
      setLockedUntil(locked > BigInt(0) ? String(locked) : null);
    } catch (error) {
      console.error("Error fetching staked balance:", error);
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

        // Enforce Base Sepolia before sending a transaction
        await ensureBaseSepolia();

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
    [
      userAddress,
      transferAndCall,
      fetchStakedBalance,
      balance,
      isMiniApp,
      ensureBaseSepolia,
    ]
  );

  // Unstake tokens
  const unstake = useCallback(
    async (amount: bigint) => {
      if (!walletClient || !userAddress) {
        throw new Error("Wallet not connected");
      }

      try {
        setUnstaking(true);

        // Enforce Base Sepolia before sending a transaction
        await ensureBaseSepolia();

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
            chain: baseSepolia,
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
    lockedUntil,
  };
}
