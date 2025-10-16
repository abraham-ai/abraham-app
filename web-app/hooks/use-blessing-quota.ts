"use client";

import { useEffect, useMemo, useState } from "react";
import { useAbrahamStaking } from "@/hooks/use-abraham-staking";
import { BLESS_TOKENS_PER_UNIT, BLESS_WINDOW_MS } from "@/lib/curation";

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
  const bless = (id: string) => {
    if (left <= 0) {
      setLimitOpen(true);
      return { ok: false as const, reason: "limit" as const };
    }
    const nextBlessings = { ...blessings, [id]: (blessings[id] ?? 0) + 1 };
    setBlessings(nextBlessings);
    if (persistBlessings) writeLocal(storageKey, nextBlessings);

    const nextUsed = used + 1;
    setUsed(nextUsed);
    writeUsed(nextUsed);

    return { ok: true as const };
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
