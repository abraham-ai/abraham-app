"use client";
import { useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
} from "viem";
import { Chain } from "viem/chains";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import { useAuth } from "@/context/AuthContext";

/* ────────── Chain config (Base Sepolia) ────────── */
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

/* ────────── Contract constants ────────── */
export const CONTRACT_ADDRESS = "0x0d70c061e12666968AAF839e7e507a96db16D6e7";
export const PRAISE_PRICE_ETHER = 0.00001;
export const BLESS_PRICE_ETHER = 0.00002;

/* ────────── Hook ────────── */
export function useAbrahamContract() {
  const { provider } = useAuth();
  const [publicClient, setPC] = useState<any>(null);
  const [walletClient, setWC] = useState<any>(null);

  /* create viem clients once we have a provider */
  useEffect(() => {
    if (!provider) return;
    setPC(
      createPublicClient({ chain: baseSepolia, transport: custom(provider) })
    );
    setWC(
      createWalletClient({ chain: baseSepolia, transport: custom(provider) })
    );
  }, [provider]);

  /** internal helper for both praise & bless */
  async function sendTx(
    fn: "praise" | "bless",
    sessionId: number,
    messageIndex: number,
    content: string = ""
  ) {
    if (!publicClient || !walletClient) throw new Error("wallet not ready");
    const [sender] = await walletClient.getAddresses();
    const valueEther = fn === "praise" ? PRAISE_PRICE_ETHER : BLESS_PRICE_ETHER;

    const txHash = await walletClient.writeContract({
      account: sender,
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: AbrahamAbi,
      functionName: fn,
      args: fn === "praise" ? [sessionId, messageIndex] : [sessionId, content],
      value: parseEther(valueEther.toString()),
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  }

  return {
    praise: (sid: number, mid: number) => sendTx("praise", sid, mid),
    bless: (sid: number, mid: number, msg: string) =>
      sendTx("bless", sid, mid, msg),
  };
}
