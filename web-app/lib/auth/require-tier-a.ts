import { verifyPrivyBearer } from "./verify-privy";
import { cdpGetOrCreateActivityWallet } from "@/lib/cdp/client";

export type TierAContext = {
  userId: string;
  activityAddress: `0x${string}`;
  chainId: number;
};

/**
 * Verifies the Privy Bearer token and resolves the caller's Tier‑A context,
 * including a per-user server-managed activity wallet address.
 *
 * Uses env.CDP_ACTIVITY_SENDER if present (useful for early/dev), otherwise
 * fetches/creates a per-user account via CDP.
 */
export async function requireTierA(req: Request): Promise<TierAContext> {
  const session = await verifyPrivyBearer(req);
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532);

  // Prefer pre-provisioned sender if configured
  const pre = process.env.CDP_ACTIVITY_SENDER as `0x${string}` | undefined;
  if (pre) {
    return { userId: session.sub, activityAddress: pre, chainId };
  }

  const { address } = await cdpGetOrCreateActivityWallet(session.sub);
  return { userId: session.sub, activityAddress: address, chainId };
}
