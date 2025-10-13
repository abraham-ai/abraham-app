"use client";

import { useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
  encodeFunctionData,
} from "viem";
import { getPreferredChain } from "@/lib/chains";
import { SystemPromptPayPatchAbi } from "@/lib/abis/experimental/SystemPromptPayPatch";
import { buildPatch } from "@/lib/patch"; // diff ➜ binary ops
import { useAuth } from "@/context/auth-context"; // gives eip1193Provider
import { useTxMode } from "@/context/tx-mode-context";
import { showErrorToast, showSuccessToast } from "@/lib/error-utils";

/* ---------- constants ---------- */
export const DOC_ADDRESS = "0xe7D34Da8ABB4c784e11555780EA609f44a33b04d";
export const DEFAULT_PRICE_PER_BYTE = BigInt("10000000000000"); // → 0.00001 ETH

/* ------------------------------------------------------------------ */
/*                     HOOK IMPLEMENTATION                            */
/* ------------------------------------------------------------------ */
export function usePromptContract() {
  const { eip1193Provider, authState } = useAuth();
  const { isMiniApp } = useTxMode();

  /* read‑only client */
  const [publicClient] = useState(() =>
    createPublicClient({
      chain: getPreferredChain(),
      transport: http(getPreferredChain().rpcUrls.default.http[0]),
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
        chain: getPreferredChain(),
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

    // Get sender address
    let sender: `0x${string}`;
    if (authState.walletAddress) {
      sender = authState.walletAddress as `0x${string}`;
    } else {
      const addresses = await walletClient.getAddresses();
      if (!addresses?.[0]) {
        showErrorToast(new Error("no account"), "No account found");
        throw new Error("no account");
      }
      sender = addresses[0];
    }

    const pricePerByte = await fetchPrice().catch(() => DEFAULT_PRICE_PER_BYTE);
    const fee = pricePerByte * BigInt(changed);

    await ensureBalance(sender, fee);

    try {
      let hash: `0x${string}`;

      // In Mini App, use provider directly (host controls chain)
      if (isMiniApp && eip1193Provider) {
        const data = encodeFunctionData({
          abi: SystemPromptPayPatchAbi,
          functionName: "applyPatch",
          args: [patch],
        });
        hash = (await eip1193Provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: sender,
              to: DOC_ADDRESS,
              data,
              value: `0x${fee.toString(16)}`,
            },
          ],
        })) as `0x${string}`;
      } else {
        // Regular Privy wallet flow
        hash = await walletClient.writeContract({
          account: sender,
          address: DOC_ADDRESS,
          abi: SystemPromptPayPatchAbi,
          functionName: "applyPatch",
          args: [patch],
          value: fee,
          chain: getPreferredChain(),
        });
      }

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
