"use client";

import { useEffect, useMemo, useState } from "react";
import { useAbrahamStaking } from "@/hooks/use-abraham-staking";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  http,
} from "viem";
import { getPreferredChain } from "@/lib/chains";
import { BLESS_TOKENS_PER_UNIT, BLESS_WINDOW_MS } from "@/lib/curation";
import {
  AbrahamCuration,
  readRemainingCredits,
  readIsDelegateApproved,
} from "@/lib/abraham-curation";
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from "@/lib/error-utils";
import { useAuth } from "@/context/auth-context";

export type BlessingsMap = Record<string, number>;

function readLocal<T = any>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T = any>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

function getWindowBucket(windowMs: number) {
  return Math.floor(Date.now() / windowMs);
}

function formatResetLabel(windowMs: number): string {
  // Human-friendly, e.g., "5 minutes", "30 seconds", "1 hour"
  if (windowMs % (60 * 60 * 1000) === 0) {
    const h = windowMs / (60 * 60 * 1000);
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  if (windowMs % (60 * 1000) === 0) {
    const m = windowMs / (60 * 1000);
    return `${m} minute${m === 1 ? "" : "s"}`;
  }
  const s = Math.round(windowMs / 1000);
  return `${s} second${s === 1 ? "" : "s"}`;
}

export function useBlessingQuota({
  persistBlessings,
  storageKey,
}: {
  persistBlessings?: boolean;
  storageKey: string;
}) {
  const { stakedBalance, userAddress, fetchStakedBalance } =
    useAbrahamStaking();
  const { user } = usePrivy();
  const { eip1193Provider } = useAuth();
  const { client: smartWalletClient, getClientForChain } = useSmartWallets();

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: getPreferredChain(),
        transport: http(getPreferredChain().rpcUrls.default.http[0]),
      }),
    []
  );

  // Config
  const TOKENS_PER_BLESS = BLESS_TOKENS_PER_UNIT;
  const WINDOW_MS = BLESS_WINDOW_MS;
  const resetLabel = formatResetLabel(WINDOW_MS);

  // Per-window usage (global across items)
  const [windowBucket, setWindowBucket] = useState<number>(() =>
    getWindowBucket(WINDOW_MS)
  );
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    const now = Date.now();
    return WINDOW_MS - (now % WINDOW_MS);
  });

  useEffect(() => {
    const id = setInterval(() => {
      const b = getWindowBucket(WINDOW_MS);
      setWindowBucket((prev) => (prev !== b ? b : prev));
      const now = Date.now();
      setRemainingMs(WINDOW_MS - (now % WINDOW_MS));
    }, 1000);
    return () => clearInterval(id);
  }, [WINDOW_MS]);

  const usageKey = useMemo(() => {
    const addr = (userAddress ?? "anon").toLowerCase();
    return `abraham_daily_bless_${addr}`; // legacy key name retained
  }, [userAddress]);

  const readUsed = () => {
    const fallback = { date: String(windowBucket), count: 0 };
    const stored = readLocal<{ date?: string | number; count?: number }>(
      usageKey,
      fallback
    );
    const date = String(stored?.date ?? "");
    if (date !== String(windowBucket)) return fallback;
    return { date, count: Number(stored.count ?? 0) };
  };

  const writeUsed = (count: number) => {
    writeLocal(usageKey, { date: String(windowBucket), count });
  };

  const [used, setUsed] = useState<number>(() => readUsed().count);
  useEffect(() => {
    setUsed(readUsed().count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usageKey, windowBucket]);

  // Allowance from stake
  const allowance = useMemo(() => {
    const sb = parseFloat(stakedBalance ?? "0");
    if (!isFinite(sb) || sb <= 0) return 0;
    return Math.floor(sb / TOKENS_PER_BLESS);
  }, [stakedBalance, TOKENS_PER_BLESS]);

  const left = Math.max(0, allowance - used);

  // Per-item blessings store
  const [blessings, setBlessings] = useState<BlessingsMap>({});

  useEffect(() => {
    if (!persistBlessings) return;
    setBlessings((prev) => ({
      ...readLocal<BlessingsMap>(storageKey, {}),
      ...prev,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistBlessings, storageKey]);

  useEffect(() => {
    if (!persistBlessings) return;
    writeLocal(storageKey, blessings);
  }, [persistBlessings, storageKey, blessings]);

  // Dialog state
  const [limitOpen, setLimitOpen] = useState(false);

  // Bless action
  const bless = async (
    id: string,
    opts?: { creationId?: string; sessionId?: string; onchainRef?: string }
  ) => {
    if (left <= 0) {
      setLimitOpen(true);
      return { ok: false as const, reason: "limit" as const };
    }
    // Determine addresses
    const linked = (user as any)?.linkedAccounts as any[] | undefined;
    const eoa = linked?.find((a: any) => a.type === "wallet" && a.address)
      ?.address as `0x${string}` | undefined;
    const smart = linked?.find(
      (a: any) => a.type === "smart_wallet" && a.address
    )?.address as `0x${string}` | undefined;

    // Build and send on-chain bless using smart wallet by default
    try {
      if (!smart && !eoa) {
        showErrorToast("No wallet linked", "Connect a wallet to bless.");
        return { ok: false as const, reason: "no-wallet" as const };
      }

      // Check on-chain credits for both addresses (friendly precheck)
      const [smartCredits, eoaCredits] = await Promise.all([
        smart
          ? readRemainingCredits(publicClient, smart)
              .then((r) => r.credits)
              .catch(() => BigInt(0))
          : Promise.resolve(BigInt(0)),
        eoa
          ? readRemainingCredits(publicClient, eoa)
              .then((r) => r.credits)
              .catch(() => BigInt(0))
          : Promise.resolve(BigInt(0)),
      ]);

      let txHash: `0x${string}` | null = null;

      // Path 1: Smart wallet has credits → send from smart wallet using its own stake
      if (smart && smartCredits > BigInt(0)) {
        const data = encodeFunctionData({
          abi: AbrahamCuration.abi,
          functionName: "bless",
          args: [opts?.sessionId ?? "", id, smart],
        });
        const swClient =
          (await getClientForChain?.({ id: getPreferredChain().id })) ||
          smartWalletClient;
        if (!swClient) {
          showErrorToast("Smart wallet not ready", "Try again in a moment.");
          return { ok: false as const, reason: "no-smart" as const };
        }
        showInfoToast("Sending blessing", "Submitting on-chain transaction...");
        txHash = await swClient.sendTransaction(
          { calls: [{ to: AbrahamCuration.address, data }] },
          { uiOptions: { showWalletUIs: false } }
        );
      }
      // Path 2: EOA has credits → prefer smart wallet caller with EOA as stakeHolder if delegated; otherwise fallback to EOA wallet
      else if (eoa && eoaCredits > BigInt(0)) {
        if (smart) {
          const approved = await readIsDelegateApproved(
            publicClient,
            eoa,
            smart
          ).catch(() => false);
          if (approved) {
            const data = encodeFunctionData({
              abi: AbrahamCuration.abi,
              functionName: "bless",
              args: [opts?.sessionId ?? "", id, eoa],
            });
            const swClient =
              (await getClientForChain?.({ id: getPreferredChain().id })) ||
              smartWalletClient;
            if (!swClient) {
              showErrorToast(
                "Smart wallet not ready",
                "Try again in a moment."
              );
              return { ok: false as const, reason: "no-smart" as const };
            }
            showInfoToast(
              "Sending blessing",
              "Submitting on-chain transaction..."
            );
            txHash = await swClient.sendTransaction(
              { calls: [{ to: AbrahamCuration.address, data }] },
              { uiOptions: { showWalletUIs: false } }
            );
          } else {
            showErrorToast(
              "Approval required",
              "Your EOA must approve your smart wallet as a delegate to bless using EOA stake."
            );
            return { ok: false as const, reason: "delegate-required" as const };
          }
        } else {
          // No smart wallet available; try direct EOA wallet flow
          if (!eip1193Provider) {
            showErrorToast(
              "Wallet not ready",
              "Connect your wallet to send the blessing."
            );
            return { ok: false as const, reason: "no-wallet-client" as const };
          }
          const walletClient = createWalletClient({
            chain: getPreferredChain(),
            transport: custom(eip1193Provider),
          });
          const data = encodeFunctionData({
            abi: AbrahamCuration.abi,
            functionName: "bless",
            args: [opts?.sessionId ?? "", id, eoa],
          });
          showInfoToast(
            "Sending blessing",
            "Submitting on-chain transaction..."
          );
          txHash = await (walletClient as any).sendTransaction?.({
            to: AbrahamCuration.address,
            data,
            account: eoa,
          });
          if (!txHash) {
            // Fallback to viem writeContract if provider supports
            txHash = await (walletClient as any).writeContract?.({
              address: AbrahamCuration.address,
              abi: AbrahamCuration.abi,
              functionName: "bless",
              args: [opts?.sessionId ?? "", id, eoa],
              account: eoa,
              chain: getPreferredChain(),
            });
          }
        }
      } else {
        showErrorToast(
          "No staking capacity",
          "Stake more ABRAHAM to gain blessing credits."
        );
        return { ok: false as const, reason: "no-credits" as const };
      }

      // Wait for tx receipt
      const rcpt = await publicClient.waitForTransactionReceipt({
        hash: txHash!,
      });
      if (rcpt.status !== "success") {
        showErrorToast("Transaction failed", "Blessing failed on-chain");
        return { ok: false as const, reason: "tx-failed" as const };
      }

      showSuccessToast("Blessed on-chain", "Recording off-chain...");

      // Only now update local usage and optimistic counts
      const nextBlessings = { ...blessings, [id]: (blessings[id] ?? 0) + 1 };
      setBlessings(nextBlessings);
      if (persistBlessings) writeLocal(storageKey, nextBlessings);
      const nextUsed = used + 1;
      setUsed(nextUsed);
      writeUsed(nextUsed);

      // Persist to backend with onchainRef
      try {
        await fetch("/api/covenant/blessings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creationId: opts?.creationId,
            session_id: opts?.sessionId,
            blesserEoa: eoa ?? null,
            blesserSmartWallet: smart ?? null,
            onchainRef: txHash!,
          }),
        });
      } catch (e) {
        console.warn("[useBlessingQuota] Failed to persist blessing:", e);
      }

      return { ok: true as const, txHash: txHash! } as const;
    } catch (e: any) {
      console.error("[useBlessingQuota] On-chain bless failed:", e);
      showErrorToast(e, "Blessing failed");
      return { ok: false as const, reason: "onchain-error" as const };
    }
  };

  return {
    // config
    tokensPerBless: TOKENS_PER_BLESS,
    windowMs: WINDOW_MS,
    resetLabel,
    // staking
    stakedBalance,
    fetchStakedBalance,
    // usage
    allowance,
    used,
    left,
    remainingMs,
    // blessings
    blessings,
    // dialog state
    limitOpen,
    setLimitOpen,
    // actions
    bless,
  };
}
