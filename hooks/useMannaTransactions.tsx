"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { MannaTokenAbi } from "@/lib/abis/MannaToken";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import { AbrahamNFTAbi } from "@/lib/abis/AbrahamNFT";
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
  formatEther,
  formatUnits,
} from "viem";
import { Chain } from "viem/chains";
import { PinataSDK } from "pinata-web3";

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

// Initialize Pinata
const pinata = new PinataSDK({
  pinataJwt: process.env.NEXT_PUBLIC_PINATA_JWT!,
  pinataGateway: "example-gateway.mypinata.cloud",
});

export function useMannaTransactions() {
  const { provider, accountAbstractionProvider } = useAuth();
  const [balance, setBalance] = useState<string>("0");

  // Replace these addresses with your deployed contract addresses
  const mannaTokenAddress = "0xF0b2D2Af2044Bd41F419c6e1D3A6B6C7Ba8094e1";
  const abrahamAddress = "0x01A101b0Cefe374D8B37736e67Bf60440D8DaEcA";
  const abrahamNFTAddress = "0x238AB35dc490255a1E5209556FF3a4a62A27C182";

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
      getMannaBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, mannaTokenAddress, accountAbstractionProvider]);

  const getMannaBalance = async () => {
    if (
      !provider ||
      !mannaTokenAddress ||
      !publicClient ||
      !accountAbstractionProvider
    )
      return;
    try {
      const [address] = await walletClient.getAddresses();
      const balance = await publicClient.readContract({
        address: mannaTokenAddress as `0x${string}`,
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

  const getContractBalances = async () => {
    if (!provider || !mannaTokenAddress || !publicClient) return;
    try {
      const [mannaBalance, ethBalance] = (await publicClient.readContract({
        address: mannaTokenAddress as `0x${string}`,
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

  const buyManna = async (etherAmount: string) => {
    if (!provider || !mannaTokenAddress || !publicClient || !walletClient) {
      throw new Error("Required dependencies are missing");
    }
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: mannaTokenAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "buyManna",
        value: parseEther(etherAmount),
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await getMannaBalance();
    } catch (error) {
      console.error("Error buying Manna:", error);
      throw error;
    }
  };

  const calculateMannaForEther = (etherAmount: string) => {
    const MANNA_PRICE = BigInt("100000000000000"); // 0.0001 Ether in Wei
    const etherAmountWei = parseEther(etherAmount);
    const mannaAmount = (etherAmountWei * BigInt(10 ** 18)) / MANNA_PRICE;
    return mannaAmount.toString();
  };

  const calculateEtherForManna = (mannaAmount: string) => {
    const MANNA_PRICE = BigInt("100000000000000");
    const mannaAmountBigInt = BigInt(mannaAmount);
    const etherAmountWei = (mannaAmountBigInt * MANNA_PRICE) / BigInt(10 ** 18);
    return formatEther(etherAmountWei);
  };

  const sellManna = async (mannaAmount: string) => {
    if (!provider || !mannaTokenAddress || !publicClient || !walletClient)
      return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: mannaTokenAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "sellManna",
        args: [BigInt(mannaAmount)],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await getMannaBalance();
    } catch (error) {
      console.error("Error selling Manna:", error);
    }
  };

  const getTotalSupply = async () => {
    if (!provider || !mannaTokenAddress || !publicClient) return;
    try {
      const totalSupply = (await publicClient.readContract({
        address: mannaTokenAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "totalSupply",
      })) as bigint;
      return totalSupply.toString();
    } catch (error) {
      console.error("Error fetching total supply:", error);
    }
  };

  // Approve Manna for Abraham
  const approveMannaForAbraham = async (amount: string) => {
    if (!provider || !mannaTokenAddress || !publicClient || !walletClient)
      return;
    try {
      const [address] = await walletClient.getAddresses();
      const txHash = await walletClient.writeContract({
        account: address,
        address: mannaTokenAddress as `0x${string}`,
        abi: MannaTokenAbi,
        functionName: "approve",
        args: [abrahamAddress, BigInt(amount)],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      console.log("Manna approved for Abraham!");
    } catch (error) {
      console.error("Error approving Manna:", error);
      throw error;
    }
  };

  const callAbrahamFunction = async (functionName: string, args: any[]) => {
    if (!provider || !abrahamAddress || !publicClient) {
      throw new Error("Required dependencies are missing");
    }
    try {
      if (
        accountAbstractionProvider &&
        accountAbstractionProvider.smartAccount
      ) {
        const bundlerClient = accountAbstractionProvider.bundlerClient!;
        const smartAccount = accountAbstractionProvider.smartAccount!;

        const userOpHash = await bundlerClient.sendUserOperation({
          account: smartAccount,
          calls: [
            {
              to: abrahamAddress,
              abi: AbrahamAbi,
              functionName,
              args,
            },
          ],
        });

        await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
      } else if (walletClient) {
        const [address] = await walletClient.getAddresses();
        const txHash = await walletClient.writeContract({
          account: address,
          address: abrahamAddress as `0x${string}`,
          abi: AbrahamAbi,
          functionName,
          args,
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      } else {
        throw new Error(
          "No wallet client or account abstraction provider available"
        );
      }

      await getMannaBalance();
    } catch (error) {
      console.error(`Error calling ${functionName} on Abraham:`, error);
      throw error;
    }
  };

  const praise = async (creationId: number | bigint, amount: string) => {
    // Ensure user has approved Manna before calling this
    // amount must meet minimumMannaSpend
    await callAbrahamFunction("praise", [BigInt(creationId), BigInt(amount)]);
  };

  const burnCreation = async (creationId: number | bigint, amount: string) => {
    // Ensure user has approved Manna before calling this
    // amount must meet minimumMannaSpend
    await callAbrahamFunction("burnCreation", [
      BigInt(creationId),
      BigInt(amount),
    ]);
  };

  const bless = async (creationId: number | bigint, amount: string) => {
    // Ensure user has approved Manna before calling this
    // amount must meet minimumMannaSpend
    await callAbrahamFunction("bless", [BigInt(creationId), BigInt(amount)]);
  };

  const uploadMetadataToPinata = async (metadata: Record<string, any>) => {
    try {
      const upload = await pinata.upload.json(metadata);
      console.log("Uploaded metadata:", upload);
      return `ipfs://${upload.IpfsHash}`;
    } catch (error) {
      console.error("Error uploading metadata to Pinata:", error);
      throw error;
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
    approveMannaForAbraham,
    praise,
    burnCreation,
    bless,
    getTotalSupply,
    uploadMetadataToPinata,
  };
}
