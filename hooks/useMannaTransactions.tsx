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
const ABRAHAM_ADDRESS = "0xA9929f23f38Ddcf2650345f61b3841dC6165e1fE";

export function useMannaTransactions() {
  const { provider, accountAbstractionProvider } = useAuth();
  const [mannaBalance, setMannaBalance] = useState<string>("0");
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

  /**
   * Approves the Abraham contract to spend the user's Manna.
   * @param amount - The maximum amount of Manna to approve as a bigint (use `2n ** 256n - 1n` for unlimited)
   */
  const approveMannaForAbraham = async (amount: bigint) => {
    if (!provider || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: ABRAHAM_ADDRESS as `0x${string}`,
        abi: AbrahamAbi,
        functionName: "approve",
        args: [ABRAHAM_ADDRESS, amount], // Approving Abraham to spend user's Manna
      });
      console.log("Approval transaction hash:", txHash);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log("Manna approved for Abraham!");
    } catch (error) {
      console.error("Error approving Manna for Abraham:", error);
    }
  };

  /**
   * Praises a creation by:
   * 1. Approving Abraham to spend user's Manna (if not already approved).
   * 2. Calling `praise(creationId)` on Abraham.
   * @param creationId - The ID of the creation to praise.
   */
  const praiseCreation = async (creationId: number) => {
    if (!provider || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();

      // Step 1: Approve (unlimited) Manna for Abraham
      const maxAllowance = BigInt(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );
      await approveMannaForAbraham(maxAllowance);

      // Step 2: Praise
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
      await getMannaBalance();
      console.log(`Unpraised creationId ${creationId} successfully!`);
    } catch (error) {
      console.error("Error unpraising creation:", error);
    }
  };

  /**
   * Lists user's praises for sale on the secondary market.
   * @param creationId - The ID of the creation.
   * @param amount - The number of praises to list for sale.
   * @param pricePerPraise - The price per praise unit in Manna (as a string, e.g., "0.2").
   */
  const listPraiseForSale = async (
    creationId: number,
    amount: number,
    pricePerPraise: string
  ) => {
    if (!provider || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();
      const pricePerPraiseWei = parseEther(pricePerPraise);

      const txHash = await walletClient.writeContract({
        account: address,
        address: ABRAHAM_ADDRESS as `0x${string}`,
        abi: AbrahamAbi,
        functionName: "listPraiseForSale",
        args: [creationId, amount, pricePerPraiseWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(
        `Listed ${amount} praises for sale at ${pricePerPraise} Manna each!`
      );
    } catch (error) {
      console.error("Error listing praises for sale:", error);
    }
  };

  /**
   * Buys praises from a specified listing on the secondary market.
   * @param listingId - The ID of the praise listing.
   * @param amount - The number of praises to buy.
   */
  const buyPraise = async (listingId: number, amount: number) => {
    if (!provider || !walletClient) return;
    try {
      const [address] = await walletClient.getAddresses();

      const txHash = await walletClient.writeContract({
        account: address,
        address: ABRAHAM_ADDRESS as `0x${string}`,
        abi: AbrahamAbi,
        functionName: "buyPraise",
        args: [listingId, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log(`Bought ${amount} praises from listing ID ${listingId}!`);
      await getMannaBalance();
    } catch (error) {
      console.error("Error buying praises:", error);
    }
  };

  return {
    mannaBalance,
    contractBalances,
    buyManna,
    sellManna,
    approveMannaForAbraham,
    praiseCreation,
    unpraiseCreation,
    listPraiseForSale,
    buyPraise,
    getMannaBalance,
    getContractBalances,
  };
}
