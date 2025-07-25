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

export const CONTRACT_ADDRESS = "0x702596A9C2CBF923E3dd2B5A99e95AbE156F5Dd6";
export const PRAISE_PRICE_ETHER = 0.00001;
export const BLESS_PRICE_ETHER = 0.00002;

export function useAbrahamContract() {
  const { eip1193Provider } = useAuth();

  /* read‑only viem client */
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

  /* ---------- helpers ---------- */
  const ensureBalance = async (addr: `0x${string}`, cost: bigint) => {
    const bal = await publicClient.getBalance({ address: addr });
    if (bal < cost) {
      showErrorToast(new Error("insufficient funds"), "Insufficient Balance");
      throw new Error("insufficient funds");
    }
  };

  const waitAndToast = async (hash: `0x${string}`, msg: string) => {
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    if (rcpt.status === "success") {
      showSuccessToast(msg, "Transaction confirmed on‑chain.");
    } else throw new Error("tx failed");
  };

  /* ---------- contract calls ---------- */

  /** Praise an existing message once */
  const praise = async (sessionUuid: string, messageUuid: string) => {
    if (!walletClient) {
      showErrorToast(new Error("wallet"), "Wallet not connected");
      throw new Error("wallet not ready");
    }
    const [sender] = await walletClient.getAddresses();
    const valueWei = parseEther(PRAISE_PRICE_ETHER.toString());
    await ensureBalance(sender, valueWei);

    try {
      const hash = await walletClient.writeContract({
        account: sender,
        address: CONTRACT_ADDRESS,
        abi: AbrahamAbi,
        functionName: "praise",
        args: [sessionUuid, messageUuid],
        value: valueWei,
        chain: baseSepolia,
      });
      await waitAndToast(hash, "Praise sent! 🙌");
      return hash;
    } catch (e: any) {
      if (!e.message?.toLowerCase().includes("user rejected"))
        showErrorToast(e, "Praise Failed");
      throw e;
    }
  };

  /** Bless (new message) – generates fresh message UUID client‑side */
  const bless = async (sessionUuid: string, content: string) => {
    if (!walletClient) {
      showErrorToast(new Error("wallet"), "Wallet not connected");
      throw new Error("wallet not ready");
    }
    if (!content.trim()) {
      showErrorToast(new Error("content"), "Content required");
      throw new Error("content required");
    }
    const [sender] = await walletClient.getAddresses();
    const valueWei = parseEther(BLESS_PRICE_ETHER.toString());
    await ensureBalance(sender, valueWei);

    const msgUuid = crypto.randomUUID(); // ✨

    try {
      const hash = await walletClient.writeContract({
        account: sender,
        address: CONTRACT_ADDRESS,
        abi: AbrahamAbi,
        functionName: "bless",
        args: [sessionUuid, msgUuid, content.trim()],
        value: valueWei,
        chain: baseSepolia,
      });
      await waitAndToast(hash, "Blessing sent! 🙏");
      return { hash, msgUuid };
    } catch (e: any) {
      if (!e.message?.toLowerCase().includes("user rejected"))
        showErrorToast(e, "Blessing Failed");
      throw e;
    }
  };

  return { praise, bless };
}
