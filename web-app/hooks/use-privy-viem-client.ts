"use client";

import { createPublicClient, http } from "viem";
import { getPreferredChain } from "@/lib/chains";
import { useViemWalletClient } from "@/hooks/use-viem-wallet-client";

/**
 * Convenience hook returning both a read‑only public client and a
 * write‑capable wallet client derived from a Privy EIP‑1193 provider.
 */
export function usePrivyViemClients(eip1193Provider: any | null) {
  const publicClient = createPublicClient({
    chain: getPreferredChain(),
    transport: http(getPreferredChain().rpcUrls.default.http[0]),
  });

  const walletClient = useViemWalletClient(eip1193Provider);

  return { publicClient, walletClient };
}
