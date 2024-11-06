// useMannaTransactions.tsx
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { MannaTokenAbi } from "@/lib/abis/MannaToken";
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
  encodeFunctionData,
} from "viem";
import { Chain } from "viem/chains";

// Define the Base Sepolia Testnet chain
const baseSepolia = {
  id: 84532, //testnet- FOrm mainnet use: 84531
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

export function useMannaTransactions() {
  const { provider } = useAuth();
  const [balance, setBalance] = useState<string>("0");
  const contractAddress = "0xA9e452769C784197eE84a37e490d7ac55110A8F1";

  // Initialize Viem clients
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: custom(provider || (window as any).ethereum),
  });

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: custom(provider || (window as any).ethereum),
  });

  useEffect(() => {
    if (provider) {
      // Fetch the user's MannaToken balance when provider or contractAddress changes
      getMannaBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, contractAddress]);

  const getMannaBalance = async () => {
    if (!provider || !contractAddress) return;
    try {
      const [address] = await walletClient.getAddresses();
      const balance = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "balanceOf",
        args: [address],
      });
      // Cast the balance to bigint since we know it returns a number
      const balanceValue = balance as bigint;
      setBalance(balanceValue.toString());
    } catch (error) {
      console.error("Error fetching Manna balance:", error);
    }
  };

  // Function to buy Manna tokens
  const buyManna = async (etherAmount: string) => {
    if (!provider || !contractAddress) return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: contractAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "buyManna",
        value: parseEther(etherAmount),
      });
      // Wait for transaction to be mined
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      // Update balance after transaction
      await getMannaBalance();
    } catch (error) {
      console.error("Error buying Manna:", error);
    }
  };

  // Function to praise a creation
  const praise = async (creationId: number, amount: string) => {
    if (!provider || !contractAddress) return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: contractAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "praise",
        args: [BigInt(creationId), BigInt(amount)],
      });
      // Wait for transaction to be mined
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      // Update balance after transaction
      await getMannaBalance();
    } catch (error) {
      console.error("Error praising creation:", error);
    }
  };

  // Function to bless a creation
  const bless = async (creationId: number, comment: string) => {
    if (!provider || !contractAddress) return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: contractAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "bless",
        args: [BigInt(creationId), comment],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
    } catch (error) {
      console.error("Error blessing creation:", error);
    }
  };

  // Function to sell Manna tokens
  const sellManna = async (mannaAmount: string) => {
    if (!provider || !contractAddress) return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: contractAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "sellManna",
        args: [BigInt(mannaAmount)],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      // Update balance after transaction
      await getMannaBalance();
    } catch (error) {
      console.error("Error selling Manna:", error);
    }
  };

  // Function to burn a creating - not to be confused with burning tokens
  const burn = async (creationId: number, amount: string) => {
    if (!provider || !contractAddress) return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: contractAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "burn",
        args: [BigInt(creationId), BigInt(amount)],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      // Update balance after transaction
      await getMannaBalance();
    } catch (error) {
      console.error("Error burning Manna:", error);
    }
  };

  // Function to get total supply of Manna tokens
  const getTotalSupply = async () => {
    if (!provider || !contractAddress) return;
    try {
      const totalSupply = (await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "totalSupply",
      })) as bigint;
      return totalSupply.toString();
    } catch (error) {
      console.error("Error fetching total supply:", error);
    }
  };

  return {
    balance,
    getMannaBalance,
    buyManna,
    praise,
    bless,
    sellManna,
    burn,
    getTotalSupply,
  };
}
