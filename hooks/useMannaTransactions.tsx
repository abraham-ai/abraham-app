"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { AbrahamAbi } from "@/lib/abis/Abraham"; // Ensure this ABI includes all necessary functions
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
    default: { http: ["https://rpc.ankr.com/base_sepolia"] },
    public: { http: ["https://rpc.ankr.com/base_sepolia"] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
} as const satisfies Chain;

// **Updated Abraham Contract Address**
const ABRAHAM_ADDRESS = process.env.NEXT_PUBLIC_ABRAHAM_ADDRESS || "";
const MANNA_ADDRESS = process.env.NEXT_PUBLIC_MANNA_ADDRESS || "";

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
   * Buys Manna by sending Ether to the contract.
   * This checks if the user has an AA-enabled smart account.
   * If yes, we send a UserOp via the bundler.
   * Otherwise, fallback to a normal contract write with the external wallet client.
   */
  const buyManna = async (etherAmount: string) => {
    if (!publicClient) return;
    try {
      if (
        accountAbstractionProvider &&
        accountAbstractionProvider.smartAccount
      ) {
        // === 1) Account Abstraction Approach ===
        const bundlerClient = accountAbstractionProvider.bundlerClient!;
        const smartAccount = accountAbstractionProvider.smartAccount!;
        // For a function that requires "msg.value" (Ether), pass it as "value" in the call object:
        const userOpHash = await bundlerClient.sendUserOperation({
          account: smartAccount,
          calls: [
            {
              to: MANNA_ADDRESS as `0x${string}`,
              abi: MannaAbi,
              functionName: "buyManna",
              // parseEther(etherAmount) will convert a string like "0.1" to the correct wei BigInt
              value: parseEther(etherAmount),
            },
          ],
        });
        // Wait for the transaction to be confirmed
        await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
        console.log("Manna purchased using Account Abstraction!");
      } else if (walletClient) {
        // === 2) Fallback to External Wallet Approach ===
        const [address] = await walletClient.getAddresses();
        const txHash = await walletClient.writeContract({
          account: address,
          address: MANNA_ADDRESS as `0x${string}`,
          abi: MannaAbi,
          functionName: "buyManna",
          value: parseEther(etherAmount),
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log("Manna purchased using external wallet!");
      } else {
        throw new Error("No wallet or account abstraction provider available.");
      }
      // After successful transaction, update the user's Manna balance
      await getMannaBalance();
    } catch (error) {
      console.error("Error buying Manna:", error);
    }
  };

  /**
   * Sells Manna to receive Ether from the contract.
   * Follows the same AA vs. wallet fallback approach.
   */
  const sellManna = async (mannaAmount: string) => {
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
              to: MANNA_ADDRESS as `0x${string}`,
              abi: MannaAbi,
              functionName: "sellManna",
              args: [BigInt(mannaAmount)],
            },
          ],
        });
        await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
        console.log("Manna sold using Account Abstraction!");
      } else if (walletClient) {
        // === 2) Fallback to External Wallet Approach ===
        const [address] = await walletClient.getAddresses();
        const txHash = await walletClient.writeContract({
          account: address,
          address: MANNA_ADDRESS as `0x${string}`,
          abi: MannaAbi,
          functionName: "sellManna",
          args: [BigInt(mannaAmount)],
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log("Manna sold using external wallet!");
      } else {
        throw new Error("No wallet or account abstraction provider available.");
      }
      // After successful transaction, update the user's Manna balance
      await getMannaBalance();
    } catch (error) {
      console.error("Error selling Manna:", error);
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
    if (!publicClient) return;
    try {
      await approveManna("100000000000000000000");
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
              abi: AbrahamAbi,
              functionName: "react",
              args: [creationId, reactionTypeInt, message],
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
          abi: AbrahamAbi,
          functionName: "react",
          args: [creationId, reactionTypeInt, message],
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

  const approveManna = async (approveAmount: string) => {
    if (!publicClient || !walletClient) return;

    try {
      // You can do this with normal wallet or account abstraction as well.
      // For simplicity, let's do the fallback external wallet approach.
      // (Feel free to replicate AA logic if desired.)
      if (
        accountAbstractionProvider &&
        accountAbstractionProvider.smartAccount
      ) {
        // (1) If using account abstraction:
        const bundlerClient = accountAbstractionProvider.bundlerClient!;
        const smartAccount = accountAbstractionProvider.smartAccount!;
        const userOpHash = await bundlerClient.sendUserOperation({
          account: smartAccount,
          calls: [
            {
              to: MANNA_ADDRESS as `0x${string}`,
              abi: MannaAbi,
              functionName: "approve",
              args: [ABRAHAM_ADDRESS, BigInt(approveAmount)],
            },
          ],
        });
        // Wait for confirmation
        await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
        console.log(`Approved Manna (via AA) for ${ABRAHAM_ADDRESS}`);
      } else {
        // (2) Fallback: External wallet
        const [address] = await walletClient.getAddresses();
        const txHash = await walletClient.writeContract({
          account: address,
          address: MANNA_ADDRESS as `0x${string}`,
          abi: MannaAbi,
          functionName: "approve",
          args: [ABRAHAM_ADDRESS, BigInt(approveAmount)],
        });
        // Wait for confirmation
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log(
          `Approved Manna (via external wallet) for ${ABRAHAM_ADDRESS}`
        );
      }
    } catch (error) {
      console.error("Error approving Manna:", error);
    }
  };

  /**
   * Unpraises a creation to receive a Manna refund.
   * Uses Account Abstraction if available; otherwise, normal contract write.
   */
  // const unpraiseCreation = async (creationId: number) => {
  //   if (!publicClient) return;
  //   try {
  //     if (
  //       accountAbstractionProvider &&
  //       accountAbstractionProvider.smartAccount
  //     ) {
  //       // === 1) Account Abstraction Approach ===
  //       const bundlerClient = accountAbstractionProvider.bundlerClient!;
  //       const smartAccount = accountAbstractionProvider.smartAccount!;
  //       const userOpHash = await bundlerClient.sendUserOperation({
  //         account: smartAccount,
  //         calls: [
  //           {
  //             to: ABRAHAM_ADDRESS,
  //             abi: AbrahamAbi,
  //             functionName: "unpraise",
  //             args: [creationId],
  //           },
  //         ],
  //       });
  //       await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
  //       console.log(
  //         `Unpraised creationId ${creationId} using Account Abstraction!`
  //       );
  //     } else if (walletClient) {
  //       // === 2) Fallback to External Wallet Approach ===
  //       const [address] = await walletClient.getAddresses();
  //       const txHash = await walletClient.writeContract({
  //         account: address,
  //         address: ABRAHAM_ADDRESS as `0x${string}`,
  //         abi: AbrahamAbi,
  //         functionName: "unpraise",
  //         args: [creationId],
  //       });
  //       await publicClient.waitForTransactionReceipt({ hash: txHash });
  //       console.log(`Unpraised creationId ${creationId} with external wallet!`);
  //     } else {
  //       throw new Error("No wallet or account abstraction provider available.");
  //     }
  //     // Update Manna balance after unpraising
  //     await getMannaBalance();
  //   } catch (error) {
  //     console.error("Error unpraising creation:", error);
  //   }
  // };

  return {
    balance,
    contractBalances,
    buyManna,
    sellManna,
    makeReaction,
    getMannaBalance,
    getContractBalances,
  };
}
