"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { MannaAbi } from "@/lib/abis/Manna";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
  formatEther,
  formatUnits,
} from "viem";
import { Chain } from "viem/chains";

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

const MANNA_ADDRESS = "0x768CFd14Fe7F02Ef395620ACFAc8a0667d75d63E";
const ABRAHAM_ADDRESS = "0xD7755cA5bCD99BC9D0c232d815cA139aBbB62280";

export function useMannaTransactions() {
  const { provider, accountAbstractionProvider } = useAuth();
  const [mannaBalance, setMannaBalance] = useState<string>("0");
  const [contractBalances, setContractBalances] = useState({
    mannaBalance: "0",
    ethBalance: "0",
  });

  const [publicClient, setPublicClient] = useState<any>(null);
  const [walletClient, setWalletClient] = useState<any>(null);

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

  useEffect(() => {
    if (provider && walletClient) {
      getMannaBalance();
      getContractBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, walletClient]);

  const getMannaBalance = async () => {
    if (!provider || !publicClient || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();
      const balance = await publicClient.readContract({
        address: MANNA_ADDRESS as `0x${string}`,
        abi: MannaAbi,
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

  const getContractBalances = async () => {
    if (!provider || !publicClient) return;
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

  const buyManna = async (etherAmount: string) => {
    if (!provider || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: MANNA_ADDRESS as `0x${string}`,
        abi: MannaAbi,
        functionName: "buyManna",
        value: parseEther(etherAmount),
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await getMannaBalance();
    } catch (error) {
      console.error("Error buying Manna:", error);
    }
  };

  const sellManna = async (mannaAmount: string) => {
    if (!provider || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: MANNA_ADDRESS as `0x${string}`,
        abi: MannaAbi,
        functionName: "sellManna",
        args: [BigInt(mannaAmount)],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await getMannaBalance();
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
      await publicClient.waitForTransactionReceipt({ hash: txHash });
    } catch (error) {
      console.error("Error praising creation:", error);
    }
  };

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
    } catch (error) {
      console.error("Error unpraising creation:", error);
    }
  };

  return {
    mannaBalance,
    contractBalances,
    buyManna,
    sellManna,
    praiseCreation,
    unpraiseCreation,
    getMannaBalance,
    getContractBalances,
  };
}
