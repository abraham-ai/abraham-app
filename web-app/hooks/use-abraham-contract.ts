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
import { showErrorToast, showSuccessToast } from "@/lib/error-utils";

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
    if (!walletClient) {
      showErrorToast(new Error("Wallet not connected"), "Connection Error");
      throw new Error("wallet not ready");
    }

    try {
      const [sender] = await walletClient.getAddresses();

      // Check if user has sufficient balance
      const balance = await publicClient.getBalance({ address: sender });
      const requiredAmount = parseEther(PRAISE_PRICE_ETHER.toString());

      if (balance < requiredAmount) {
        showErrorToast(new Error("insufficient funds"), "Insufficient Balance");
        throw new Error("Insufficient funds");
      }

      const hash = await walletClient.writeContract({
        account: sender,
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: AbrahamAbi,
        functionName: "praise",
        args: [sessionId, messageIdx],
        value: requiredAmount,
        chain: baseSepolia,
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        showSuccessToast(
          "Praise Sent! 🙌",
          "Your praise has been recorded on the blockchain."
        );
      } else {
        throw new Error("Transaction failed");
      }

      return hash;
    } catch (error: any) {
      console.error("Praise error:", error);

      // Don't show toast for user rejection as it's intentional
      if (!error.message?.toLowerCase().includes("user rejected")) {
        showErrorToast(error, "Praise Failed");
      }

      throw error;
    }
  };

  const bless = async (sessionId: number, content: string) => {
    if (!walletClient) {
      showErrorToast(new Error("Wallet not connected"), "Connection Error");
      throw new Error("wallet not ready");
    }

    if (!content.trim()) {
      showErrorToast(new Error("Content required"), "Missing Content");
      throw new Error("Content is required");
    }

    try {
      const [sender] = await walletClient.getAddresses();

      // Check if user has sufficient balance
      const balance = await publicClient.getBalance({ address: sender });
      const requiredAmount = parseEther(BLESS_PRICE_ETHER.toString());

      if (balance < requiredAmount) {
        showErrorToast(new Error("insufficient funds"), "Insufficient Balance");
        throw new Error("Insufficient funds");
      }

      const hash = await walletClient.writeContract({
        account: sender,
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: AbrahamAbi,
        functionName: "bless",
        args: [sessionId, content.trim()],
        value: requiredAmount,
        chain: baseSepolia,
      });

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        showSuccessToast(
          "Blessing Sent! 🙏",
          "Your blessing has been added to the creation."
        );
      } else {
        throw new Error("Transaction failed");
      }

      return hash;
    } catch (error: any) {
      console.error("Bless error:", error);

      // Don't show toast for user rejection as it's intentional
      if (!error.message?.toLowerCase().includes("user rejected")) {
        showErrorToast(error, "Blessing Failed");
      }

      throw error;
    }
  };

  return { praise, bless };
}
