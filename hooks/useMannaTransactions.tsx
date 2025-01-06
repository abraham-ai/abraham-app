"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { AbrahamAbi } from "@/lib/abis/Abraham"; // Ensure this ABI includes all necessary functions
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
  formatEther,
  formatUnits,
} from "viem";
import { Chain } from "viem/chains";

// Define the blockchain network configuration (Base Sepolia)
const baseSepolia = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Base Sepolia ETH",
    symbol: "ETH",
  },
  rpcUrls: {
    default: { http: ["https://rpc.ankr.com/base_sepolia"] },
    public: { http: ["https://rpc.ankr.com/base_sepolia"] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
} as const satisfies Chain;

// **Updated Abraham Contract Address**
const ABRAHAM_ADDRESS = "0x3017258EB67f816F9504c7e0d41665022166d66E";

export function useMannaTransactions() {
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

  // Fetch Balances when Provider and Wallet Client are ready
  useEffect(() => {
    if (provider && walletClient) {
      getMannaBalance();
      getContractBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, walletClient]);

  /**
   * Fetches the Manna balance of the connected user.
   */
  const getMannaBalance = async () => {
    if (!provider || !publicClient || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();
      console.log("Fetching balance for Address:", address);
      const balance = await publicClient.readContract({
        address: ABRAHAM_ADDRESS as `0x${string}`,
        abi: AbrahamAbi,
        functionName: "balanceOf",
        args: [address],
      });
      const balanceValue = balance as bigint;
      const formattedBalance = formatUnits(balanceValue, 18);
      setMannaBalance(formattedBalance);
      console.log("Manna balance:", formattedBalance);
      return formattedBalance;
    } catch (error) {
      console.error("Error fetching Manna balance:", error);
    }
  };

  /**
   * Fetches the contract's Manna and Ether balances.
   */
  const getContractBalances = async () => {
    if (!provider || !publicClient) return;
    try {
      const [manna, eth] = (await publicClient.readContract({
        address: ABRAHAM_ADDRESS as `0x${string}`,
        abi: AbrahamAbi,
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
   * Buys Manna by sending Ether to the contract.
   * @param etherAmount - The amount of Ether to send as a string (e.g., "0.1")
   */
  const buyManna = async (etherAmount: string) => {
    if (!provider || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: ABRAHAM_ADDRESS as `0x${string}`,
        abi: AbrahamAbi,
        functionName: "buyManna",
        value: parseEther(etherAmount),
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await getMannaBalance();
      console.log("Manna purchased successfully!");
    } catch (error) {
      console.error("Error buying Manna:", error);
    }
  };

  /**
   * Sells Manna to receive Ether from the contract.
   * @param mannaAmount - The amount of Manna to sell as a string representing a BigInt (e.g., "1000000000000000000")
   */
  const sellManna = async (mannaAmount: string) => {
    if (!provider || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: ABRAHAM_ADDRESS as `0x${string}`,
        abi: AbrahamAbi,
        functionName: "sellManna",
        args: [BigInt(mannaAmount)],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await getMannaBalance();
      console.log("Manna sold successfully!");
    } catch (error) {
      console.error("Error selling Manna:", error);
    }
  };

  const praiseCreation = async (creationId: number) => {
    if (!provider || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();

      const txHash = await walletClient.writeContract({
        account: address,
        address: ABRAHAM_ADDRESS as `0x${string}`,
        abi: AbrahamAbi,
        functionName: "praise",
        args: [creationId],
      });
      console.log("Praise transaction hash:", txHash);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`Praised creationId ${creationId} successfully!`);
      await getMannaBalance();
    } catch (error) {
      console.error("Error praising creation:", error);
    }
  };

  /**
   * Unpraises a creation to receive a Manna refund.
   * @param creationId - The ID of the creation to unpraise.
   */
  const unpraiseCreation = async (creationId: number) => {
    if (!provider || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: ABRAHAM_ADDRESS as `0x${string}`,
        abi: AbrahamAbi,
        functionName: "unpraise",
        args: [creationId],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`Unpraised creationId ${creationId} successfully!`);
      await getMannaBalance();
    } catch (error) {
      console.error("Error unpraising creation:", error);
    }
  };

  return {
    balance,
    contractBalances,
    buyManna,
    sellManna,
    praiseCreation,
    unpraiseCreation,
    getMannaBalance,
    getContractBalances,
  };
}
