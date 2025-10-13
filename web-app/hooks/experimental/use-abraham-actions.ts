"use client";

import { useTxMode } from "@/context/tx-mode-context";
import { useAbrahamSmartWallet } from "@/hooks/experimental/use-abraham-smartwallet";
import { useAbrahamContract } from "@/hooks/experimental/use-abraham-contract";

export function useAbrahamActions() {
  const { mode } = useTxMode();
  const sw = useAbrahamSmartWallet();
  const eoa = useAbrahamContract();

  const praise = async (
    sessionUuid: string,
    messageUuid: string,
    opts?: { immediate?: boolean }
  ) => {
    if (mode === "smart") return sw.praise(sessionUuid, messageUuid, opts);
    return eoa.praise(sessionUuid, messageUuid);
  };

  const bless = async (
    sessionUuid: string,
    content: string,
    opts?: { immediate?: boolean }
  ) => {
    if (mode === "smart") return sw.bless(sessionUuid, content, opts);
    return eoa.bless(sessionUuid, content);
  };

  return {
    mode,
    praise,
    bless,
    flushBatch: sw.flushBatch,
    pendingCallsCount: sw.pendingCallsCount,
  };
}
