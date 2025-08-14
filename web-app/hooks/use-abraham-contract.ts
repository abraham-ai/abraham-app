"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
  type PublicClient,
  type WalletClient,
} from "viem";
import { baseSepolia } from "@/lib/base-sepolia";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import { useAuth } from "@/context/auth-context";
import { showErrorToast, showSuccessToast } from "@/lib/error-utils";

/* ------------------------------------------------------------------ */
/*                        CONTRACT + PRICES                           */
/* ------------------------------------------------------------------ */
export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_ABRAHAM_ADDRESS as `0x${string}`) ??
  "0xd2A2aEe7a4576D9A8Fc82eCe64b9bd589f819dEc";

export const PRAISE_PRICE_ETHER = 0.00001;
export const BLESS_PRICE_ETHER = 0.00002;

const PRAISE_PRICE_WEI = parseEther(PRAISE_PRICE_ETHER.toString());
const BLESS_PRICE_WEI = parseEther(BLESS_PRICE_ETHER.toString());

/**
 * Read-/write helpers for the Abraham contract.
 * - Guards against wallet absence and insufficient balance.
 * - Includes single + batch actions for users (praise/bless).
 * - All txs will toast on success; rejections won’t spam errors.
 */
export function useAbrahamContract() {
  const { eip1193Provider } = useAuth();

  /* ---------- viem clients ---------- */
  const publicClient: PublicClient = useMemo(
    () =>
      createPublicClient({
        chain: baseSepolia,
        transport: http(baseSepolia.rpcUrls.default.http[0]),
      }),
    []
  );

  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

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
  const requireWallet = async () => {
    if (!walletClient) {
      const err = new Error("Wallet not connected");
      showErrorToast(err, "Wallet not connected");
      throw err;
    }
    const accounts = await walletClient.getAddresses();
    if (!accounts?.length) {
      const err = new Error("No account found");
      showErrorToast(err, "Wallet not connected");
      throw err;
    }
    return accounts[0]!;
  };

  const ensureBalance = async (addr: `0x${string}`, cost: bigint) => {
    const bal = await publicClient.getBalance({ address: addr });
    if (bal < cost) {
      const err = new Error("Insufficient funds");
      showErrorToast(err, "Insufficient Balance");
      throw err;
    }
  };

  const waitAndToast = async (hash: `0x${string}`, msg: string) => {
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    if (rcpt.status === "success") {
      showSuccessToast(msg, "Transaction confirmed on-chain.");
    } else {
      throw new Error("Transaction failed");
    }
  };

  const isUserReject = (e: any) =>
    typeof e?.message === "string" &&
    e.message.toLowerCase().includes("user rejected");

  /* ------------------------------------------------------------------ */
  /*                             SINGLE ACTIONS                          */
  /* ------------------------------------------------------------------ */

  /** Praise any message (unlimited). */
  const praise = async (sessionUuid: string, messageUuid: string) => {
    const sender = await requireWallet();
    const valueWei = PRAISE_PRICE_WEI;
    await ensureBalance(sender, valueWei);

    try {
      const hash = await walletClient!.writeContract({
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
      if (!isUserReject(e)) showErrorToast(e, "Praise Failed");
      throw e;
    }
  };

  /** Bless (add a text-only message). Generates UUID client-side. */
  const bless = async (sessionUuid: string, content: string) => {
    const trimmed = (content ?? "").trim();
    if (!trimmed) {
      const err = new Error("Content required");
      showErrorToast(err, "Content required");
      throw err;
    }

    const sender = await requireWallet();
    const valueWei = BLESS_PRICE_WEI;
    await ensureBalance(sender, valueWei);

    const msgUuid = crypto.randomUUID();

    try {
      const hash = await walletClient!.writeContract({
        account: sender,
        address: CONTRACT_ADDRESS,
        abi: AbrahamAbi,
        functionName: "bless",
        args: [sessionUuid, msgUuid, trimmed],
        value: valueWei,
        chain: baseSepolia,
      });
      await waitAndToast(hash, "Blessing sent! 🙏");
      return { hash, msgUuid };
    } catch (e: any) {
      if (!isUserReject(e)) showErrorToast(e, "Blessing Failed");
      throw e;
    }
  };

  return { praise, bless };
}
