"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { MannaTokenAbi } from "@/lib/abis/MannaToken";
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

export function useMannaTransactions() {
  const { provider, accountAbstractionProvider } = useAuth();
  const [balance, setBalance] = useState<string>("0");
  const contractAddress = "0x44afFF32983b8759D9465bC4675a979432000f96"; //contract address

  // Initialize Viem clients
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
    if (provider && accountAbstractionProvider) {
      // Fetch the user's MannaToken balance when provider or contractAddress changes
      getMannaBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, contractAddress, accountAbstractionProvider]);

  const getMannaBalance = async () => {
    if (
      !provider ||
      !contractAddress ||
      !publicClient ||
      !accountAbstractionProvider
    )
      return;
    try {
      //const smartAccount = accountAbstractionProvider.smartAccount!;
      //const address = await smartAccount.getAddress(); // Get the smart account address
      let address: string;

      if (
        accountAbstractionProvider &&
        accountAbstractionProvider.smartAccount
      ) {
        const smartAccount = accountAbstractionProvider.smartAccount!;
        address = await smartAccount.getAddress(); // Get the smart account address
      } else if (walletClient) {
        const [addr] = await walletClient.getAddresses();
        address = addr;
      } else {
        // Use the provider to get the address
        const accounts = await provider.request({ method: "eth_accounts" });
        address = (accounts as string[])[0];
      }
      const balance = await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "balanceOf",
        args: [address],
      });
      const balanceValue = balance as bigint;
      const formattedBalance = formatUnits(balanceValue, 18);
      setBalance(formattedBalance);
      return formattedBalance;
    } catch (error) {
      console.error("Error fetching Manna balance:", error);
    }
  };

  // New function to get contract balances
  const getContractBalances = async () => {
    if (!provider || !contractAddress || !publicClient) return;
    try {
      const [mannaBalance, ethBalance] = (await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "getContractBalances",
      })) as [bigint, bigint];

      return {
        mannaBalance: formatUnits(mannaBalance, 18),
        ethBalance: formatEther(ethBalance),
      };
    } catch (error) {
      console.error("Error fetching contract balances:", error);
    }
  };

  // Function to buy Manna tokens - not using Account Abstraction
  const buyManna = async (etherAmount: string) => {
    if (!provider || !contractAddress || !publicClient || !walletClient) {
      throw new Error("Required dependencies are missing");
    }
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
      throw error; // Re-throw the error to propagate it to the calling function
    }
  };

  // Function to calculate the amount of Manna tokens to be received for a given Ether amount
  const calculateMannaForEther = (etherAmount: string) => {
    const MANNA_PRICE = BigInt("100000000000000"); // 0.0001 Ether in Wei
    const etherAmountWei = parseEther(etherAmount);
    const mannaAmount = (etherAmountWei * BigInt(10 ** 18)) / MANNA_PRICE;
    return mannaAmount.toString();
  };

  // Function to calculate the amount of Ether to be received for a given Manna amount
  const calculateEtherForManna = (mannaAmount: string) => {
    const MANNA_PRICE = BigInt("100000000000000"); // 0.0001 Ether in Wei
    const mannaAmountBigInt = BigInt(mannaAmount);
    const etherAmountWei = (mannaAmountBigInt * MANNA_PRICE) / BigInt(10 ** 18);
    return formatEther(etherAmountWei);
  };

  // Function to sell Manna tokens - not using Account Abstraction
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

  // Function to praise a creation
  const praise = async (creationId: number | bigint, amount: bigint) => {
    if (!provider || !contractAddress || !publicClient) {
      throw new Error("Required dependencies are missing");
    }
    try {
      if (
        accountAbstractionProvider &&
        accountAbstractionProvider.smartAccount
      ) {
        // Use Account Abstraction
        const bundlerClient = accountAbstractionProvider.bundlerClient!;
        const smartAccount = accountAbstractionProvider.smartAccount!;

        const userOpHash = await bundlerClient.sendUserOperation({
          account: smartAccount,
          calls: [
            {
              to: contractAddress,
              abi: MannaTokenAbi,
              functionName: "praise",
              args: [BigInt(creationId), amount],
            },
          ],
        });

        await bundlerClient.waitForUserOperationReceipt({
          hash: userOpHash,
        });

        // Update balance after transaction
        await getMannaBalance();
      } else if (walletClient) {
        // Use walletClient with provider
        const [address] = await walletClient.getAddresses();

        const txHash = await walletClient.writeContract({
          account: address,
          address: contractAddress as `0x${string}`,
          abi: MannaTokenAbi,
          functionName: "praise",
          args: [BigInt(creationId), amount],
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        // Update balance after transaction
        await getMannaBalance();
      } else {
        throw new Error(
          "No account abstraction provider or wallet client available"
        );
      }
    } catch (error) {
      console.error("Error praising creation:", error);
      throw error;
    }
  };

  // Function to burn a creation
  const burn = async (creationId: number | bigint, amount: bigint) => {
    if (
      !provider ||
      !contractAddress ||
      !publicClient ||
      !accountAbstractionProvider
    ) {
      throw new Error("Required dependencies are missing");
    }
    try {
      const bundlerClient = accountAbstractionProvider.bundlerClient!;
      const smartAccount = accountAbstractionProvider.smartAccount!;

      const userOpHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [
          {
            to: contractAddress,
            abi: MannaTokenAbi,
            functionName: "burn",
            args: [BigInt(creationId), amount],
          },
        ],
      });

      await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      // Update balance after transaction
      await getMannaBalance();
    } catch (error) {
      console.error("Error burning creation:", error);
      throw error;
    }
  };

  // Function to bless a creation
  const bless = async (creationId: number | bigint, comment: string) => {
    if (
      !provider ||
      !contractAddress ||
      !publicClient ||
      !accountAbstractionProvider
    )
      return;
    try {
      const bundlerClient = accountAbstractionProvider.bundlerClient!;
      const smartAccount = accountAbstractionProvider.smartAccount!;

      const userOpHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [
          {
            to: contractAddress,
            abi: MannaTokenAbi,
            functionName: "bless",
            args: [BigInt(creationId), comment],
          },
        ],
      });

      await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });

      // Update balance after transaction
      await getMannaBalance();
    } catch (error) {
      console.error("Error blessing creation:", error);
    }
  };

  // Function to get total supply of Manna tokens
  const getTotalSupply = async () => {
    if (!provider || !contractAddress || !publicClient) return;
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
    getContractBalances,
    calculateMannaForEther,
    calculateEtherForManna,
    buyManna,
    sellManna,
    praise,
    burn,
    bless,
    getTotalSupply,
  };
}
