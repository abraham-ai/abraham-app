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
import { SystemPromptPayPatchAbi } from "@/lib/abis/SystemPromptPayPatch";
import { buildPatch } from "@/lib/patch"; // diff ➜ binary ops
import { useAuth } from "@/context/auth-context"; // gives eip1193Provider
import { showErrorToast, showSuccessToast } from "@/lib/error-utils";

/* ---------- constants ---------- */
export const DOC_ADDRESS = "0xe7D34Da8ABB4c784e11555780EA609f44a33b04d";
export const DEFAULT_PRICE_PER_BYTE = BigInt("10000000000000"); // → 0.00001 ETH

/* ------------------------------------------------------------------ */
/*                     HOOK IMPLEMENTATION                            */
/* ------------------------------------------------------------------ */
export function usePromptContract() {
  const { eip1193Provider } = useAuth();

  /* read‑only client */
  const [publicClient] = useState(() =>
    createPublicClient({
      chain: baseSepolia,
      transport: http(baseSepolia.rpcUrls.default.http[0]),
    })
  );

  /* signer client (writes) */
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
      showErrorToast(new Error("bal"), "Insufficient balance");
      throw new Error("insufficient funds");
    }
  };

  const waitAndToast = async (hash: `0x${string}`, msg: string) => {
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    if (rcpt.status === "success") {
      showSuccessToast(msg, "Tx confirmed on‑chain");
    } else throw new Error("tx failed");
  };

  /* ---------- READS ---------- */
  const fetchText = async () =>
    (await publicClient.readContract({
      address: DOC_ADDRESS,
      abi: SystemPromptPayPatchAbi,
      functionName: "text",
    })) as string;

  const fetchPrice = async () =>
    (await publicClient.readContract({
      address: DOC_ADDRESS,
      abi: SystemPromptPayPatchAbi,
      functionName: "pricePerByte",
    })) as bigint;

  /* ---------- WRITES ---------- */

  /**
   * Update the prompt.
   * @param oldText current on‑chain text (pass what you just fetched)
   * @param newText user‑edited draft
   */
  const savePrompt = async (oldText: string, newText: string) => {
    if (!walletClient) {
      showErrorToast(new Error("wallet"), "Wallet not connected");
      throw new Error("wallet not ready");
    }
    if (oldText === newText) return; // nothing to do

    const { hex: patch, changed } = buildPatch(oldText, newText);

    const [sender] = await walletClient.getAddresses();
    const pricePerByte = await fetchPrice().catch(() => DEFAULT_PRICE_PER_BYTE);
    const fee = pricePerByte * BigInt(changed);

    await ensureBalance(sender, fee);

    try {
      const hash = await walletClient.writeContract({
        account: sender,
        address: DOC_ADDRESS,
        abi: SystemPromptPayPatchAbi,
        functionName: "applyPatch",
        args: [patch],
        value: fee,
        chain: baseSepolia,
      });
      await waitAndToast(hash, "Prompt updated! ✨");
      return hash;
    } catch (e: any) {
      if (!e.message?.toLowerCase().includes("user rejected"))
        showErrorToast(e, "Update failed");
      throw e;
    }
  };

  return { fetchText, fetchPrice, savePrompt };
}
