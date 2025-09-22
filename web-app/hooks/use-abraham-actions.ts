"use client";

import { useTxMode } from "@/context/tx-mode-context";
import {
  useAbrahamSmartWallet,
  PRAISE_PRICE_ETHER as SW_PRAISE,
  BLESS_PRICE_ETHER as SW_BLESS,
} from "@/hooks/use-abraham-smartwallet";
import {
  useAbrahamContract,
  PRAISE_PRICE_ETHER as EOA_PRAISE,
  BLESS_PRICE_ETHER as EOA_BLESS,
} from "@/hooks/use-abraham-contract";

export const PRAISE_PRICE_ETHER = SW_PRAISE; // same constants across paths
export const BLESS_PRICE_ETHER = SW_BLESS;

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
