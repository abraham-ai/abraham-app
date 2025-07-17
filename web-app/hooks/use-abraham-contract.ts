"use client";

import { useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
} from "viem";
import { baseSepolia } from "@/lib/base-sepolia";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import { useAuth } from "@/context/auth-context";

/* ---------- constants ---------- */
export const CONTRACT_ADDRESS = "0x3667BD9cb464f4492899384c6f73908d6681EC78";
export const PRAISE_PRICE_ETHER = 0.00001;
export const BLESS_PRICE_ETHER = 0.00002;

/* ---------- hook ---------- */
export function useAbrahamContract() {
  const { eip1193Provider } = useAuth();

  /* read‑only client */
  const [publicClient] = useState(() =>
    createPublicClient({
      chain: baseSepolia,
      transport: http(baseSepolia.rpcUrls.default.http[0]),
    })
  );

  /* wallet client (writes) */
  const [walletClient, setWalletClient] = useState<ReturnType<
    typeof createWalletClient
  > | null>(null);

  useEffect(() => {
    if (!eip1193Provider) {
      setWalletClient(null);
      return;
    }
    setWalletClient(
      createWalletClient({
        chain: baseSepolia,
        transport: custom(eip1193Provider),
      })
    );
  }, [eip1193Provider]);

  /* ---------- contract methods ---------- */
  const praise = async (sessionId: number, messageIdx: number) => {
    if (!walletClient) throw new Error("wallet not ready");
    const [sender] = await walletClient.getAddresses();

    const hash = await walletClient.writeContract({
      account: sender,
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: AbrahamAbi,
      functionName: "praise",
      args: [sessionId, messageIdx],
      value: parseEther(PRAISE_PRICE_ETHER.toString()),
      chain: baseSepolia,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  };

  const bless = async (sessionId: number, content: string) => {
    if (!walletClient) throw new Error("wallet not ready");
    const [sender] = await walletClient.getAddresses();
    const hash = await walletClient.writeContract({
      account: sender,
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: AbrahamAbi,
      functionName: "bless",
      args: [sessionId, content],
      value: parseEther(BLESS_PRICE_ETHER.toString()),
      chain: baseSepolia,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  };

  return { praise, bless };
}
