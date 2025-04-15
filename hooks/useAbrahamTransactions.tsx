"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { AbrahamEthAbi } from "@/lib/abis/AbrahamEth";
import { MannaAbi } from "@/lib/abis/Manna";
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
  formatEther,
  formatUnits,
} from "viem";
import { Chain } from "viem/chains";

// Your chain config for Base Sepolia
const baseSepolia = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Base Sepolia ETH",
    symbol: "ETH",
  },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL as string] },
    public: { http: [process.env.NEXT_PUBLIC_RPC_URL as string] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
} as const satisfies Chain;

// Addresses
const ABRAHAM_ADDRESS = process.env.NEXT_PUBLIC_ABRAHAM_ADDRESS || "";
const MANNA_ADDRESS = process.env.NEXT_PUBLIC_MANNA_ADDRESS || "";

export function useAbrahamTransactions() {
  const { provider, accountAbstractionProvider } = useAuth();
  const [balance, setMannaBalance] = useState<string>("0");
  const [contractBalances, setContractBalances] = useState({
    mannaBalance: "0",
    ethBalance: "0",
  });

  const [publicClient, setPublicClient] = useState<any>(null);
  const [walletClient, setWalletClient] = useState<any>(null);

  // Initialize Public and Wallet Clients
  useEffect(() => {
    if (provider) {
      const pc = createPublicClient({
        chain: baseSepolia,
        transport: custom(provider),
      });
      const wc = createWalletClient({
        chain: baseSepolia,
        transport: custom(provider),
      });
      setPublicClient(pc);
      setWalletClient(wc);
    }
  }, [provider]);

  // Fetch Manna + Contract Balances
  useEffect(() => {
    if (provider && walletClient) {
      getMannaBalance();
      getContractBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, walletClient]);

  /**
   * Fetch the user’s Manna balance.
   */
  const getMannaBalance = async () => {
    if (!publicClient || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();
      const balanceData = await publicClient.readContract({
        address: MANNA_ADDRESS as `0x${string}`,
        abi: MannaAbi,
        functionName: "balanceOf",
        args: [address],
      });
      const balanceValue = balanceData as bigint;
      const formattedBalance = formatUnits(balanceValue, 18);
      setMannaBalance(formattedBalance);
      return formattedBalance;
    } catch (error) {
      console.error("Error fetching Manna balance:", error);
    }
  };

  /**
   * Fetch the Manna & ETH in the contract. Just for reference.
   */
  const getContractBalances = async () => {
    if (!publicClient) return;
    try {
      const [manna, eth] = (await publicClient.readContract({
        address: MANNA_ADDRESS as `0x${string}`,
        abi: MannaAbi,
        functionName: "getContractBalances",
      })) as [bigint, bigint];

      setContractBalances({
        mannaBalance: formatUnits(manna, 18),
        ethBalance: formatEther(eth),
      });
      return {
        mannaBalance: formatUnits(manna, 18),
        ethBalance: formatEther(eth),
      };
    } catch (error) {
      console.error("Error fetching contract balances:", error);
    }
  };

  /**
   * Sends a reaction (praise, burn, bless) to the Abraham contract.
   *
   * @param creationId ID of the creation
   * @param reactionType "praise" | "burn" | "bless"
   * @param message Optional text (used for blessings)
   * @param costInEth The base cost in Ether for a praise. If bless, we multiply by 5.
   */
  const makeReaction = async (
    creationId: number,
    reactionType: string,
    message: string,
    costInEth: number
  ) => {
    if (!publicClient) return;
    try {
      const reactionTypeInt =
        reactionType === "praise" ? 0 : reactionType === "burn" ? 1 : 2;

      // If bless => cost is costInEth * 5; if burn, it’s the same as praise in your contract?
      // (Your contract logic: burn uses same price as praise. Bless is 5X.)
      const finalCost = reactionType === "bless" ? costInEth * 5 : costInEth;

      if (accountAbstractionProvider?.smartAccount) {
        // 1) Account Abstraction
        const bundlerClient = accountAbstractionProvider.bundlerClient!;
        const smartAccount = accountAbstractionProvider.smartAccount!;
        const userOpHash = await bundlerClient.sendUserOperation({
          account: smartAccount,
          calls: [
            {
              to: ABRAHAM_ADDRESS as `0x${string}`,
              abi: AbrahamEthAbi,
              functionName: "react",
              args: [creationId, reactionTypeInt, message],
              value: parseEther(finalCost.toString()),
            },
          ],
        });
        await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
      } else if (walletClient) {
        // 2) External Wallet
        const [address] = await walletClient.getAddresses();
        const txHash = await walletClient.writeContract({
          account: address,
          address: ABRAHAM_ADDRESS as `0x${string}`,
          abi: AbrahamEthAbi,
          functionName: "react",
          args: [creationId, reactionTypeInt, message],
          value: parseEther(finalCost.toString()),
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      } else {
        throw new Error("No wallet or account abstraction provider available.");
      }

      // Refresh Manna or do any post-transaction logic...
      await getMannaBalance();
    } catch (error) {
      console.error("Error reacting to creation:", error);
      throw error;
    }
  };

  return {
    balance,
    contractBalances,
    makeReaction,
    getMannaBalance,
    getContractBalances,
  };
}
