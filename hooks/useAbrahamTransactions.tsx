"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { AbrahamEthAbi } from "@/lib/abis/AbrahamEth"; // Ensure this ABI includes all necessary functions
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
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL as string] },
    public: { http: [process.env.NEXT_PUBLIC_RPC_URL as string] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
} as const satisfies Chain;

// **Updated Abraham Contract Address**
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
    if (!publicClient || !walletClient) return;
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
      return formattedBalance;
    } catch (error) {
      console.error("Error fetching Manna balance:", error);
    }
  };

  /**
   * Fetches the contract's Manna and Ether balances.
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
   * Make a reaction a creation.
   * Uses Account Abstraction if available; otherwise, normal contract write.
   */
  const makeReaction = async (
    creationId: number,
    reactionType: string,
    message: string
  ) => {
    //praise = 0, burn = 1, bless = 2
    const reactionTypeInt =
      reactionType === "praise" ? 0 : reactionType === "burn" ? 1 : 2;
    //const allowance = await getMannaAllowance();
    // For example, if each reaction costs 10 Manna, we can check:
    //const needed = parseEther("10");

    if (!publicClient) return;
    try {
      if (
        accountAbstractionProvider &&
        accountAbstractionProvider.smartAccount
      ) {
        // === 1) Account Abstraction Approach ===
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
              value: parseEther("0.002"),
            },
          ],
        });
        await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
        console.log(
          `Praised creationId ${creationId} using Account Abstraction!`
        );
      } else if (walletClient) {
        // === 2) Fallback to External Wallet Approach ===
        const [address] = await walletClient.getAddresses();
        const txHash = await walletClient.writeContract({
          account: address,
          address: ABRAHAM_ADDRESS as `0x${string}`,
          abi: AbrahamEthAbi,
          functionName: "react",
          args: [creationId, reactionTypeInt, message],
          value: parseEther("0.002"),
        });
        console.log("Praise transaction hash:", txHash);
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log(`Praised creationId ${creationId} with external wallet!`);
      } else {
        throw new Error("No wallet or account abstraction provider available.");
      }
      // Update Manna balance after praising
      await getMannaBalance();
    } catch (error) {
      console.error("Error praising creation:", error);
    }
  };

  // const getMannaAllowance = async () => {
  //   if (!publicClient || !walletClient) return BigInt(0);
  //   try {
  //     const [address] = await walletClient.getAddresses();
  //     const allowance = await publicClient.readContract({
  //       address: MANNA_ADDRESS as `0x${string}`,
  //       abi: MannaAbi,
  //       functionName: "allowance",
  //       args: [address, ABRAHAM_ADDRESS],
  //     });
  //     return allowance as bigint;
  //   } catch (error) {
  //     console.error("Error fetching allowance:", error);
  //     return BigInt(0);
  //   }
  // };

  return {
    balance,
    contractBalances,
    makeReaction,
    getMannaBalance,
    getContractBalances,
  };
}
