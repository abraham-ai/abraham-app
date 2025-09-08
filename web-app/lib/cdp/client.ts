/** Minimal CDP v2 client wrapper using fetch.
 * Docs: https://docs.cdp.coinbase.com/api-reference/v2/authentication
 * This module assumes you have set CDP_API_KEY and CDP_API_SECRET in env.
 */

type Hex = `0x${string}`;

const CDP_BASE =
  process.env.CDP_BASE_URL || "https://api.developer.coinbase.com";
const CDP_API_KEY = process.env.CDP_API_KEY || "";
const CDP_API_SECRET = process.env.CDP_API_SECRET || "";

if (!CDP_API_KEY || !CDP_API_SECRET) {
  // Keep silent at import time in Next runtime; routes can decide to 500 if missing
}

function authHeaders() {
  // For v2, use Bearer key per docs; if HMAC is required, extend here accordingly.
  return {
    Authorization: `Bearer ${CDP_API_KEY}:${CDP_API_SECRET}`,
    "Content-Type": "application/json",
  } as const;
}

export type CdpTxRequest = {
  from: Hex; // user's activity smart account
  to: Hex;
  data?: Hex;
  value?: string; // decimal string in wei
  chainId: number;
};

export async function cdpSendTransaction(
  req: CdpTxRequest
): Promise<{ hash: Hex }> {
  if (!CDP_API_KEY || !CDP_API_SECRET)
    throw new Error("CDP credentials missing");

  const res = await fetch(`${CDP_BASE}/wallets/v2/transactions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      from: req.from,
      to: req.to,
      data: req.data ?? "0x",
      value: req.value ?? "0",
      chain_id: req.chainId,
      sponsor_gas: true,
      policy: "tierA",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `CDP tx error ${res.status}: ${body?.error || JSON.stringify(body)}`
    );
  }
  return { hash: (body.hash || body.txHash) as Hex };
}

export async function cdpGetOrCreateActivityWallet(
  userId: string
): Promise<{ address: Hex }> {
  if (!CDP_API_KEY || !CDP_API_SECRET)
    throw new Error("CDP credentials missing");
  // This is app-specific. For now, simulate a lookup or creation via your backend service.
  // Replace with your actual API path once available.
  const res = await fetch(`${CDP_BASE}/wallets/v2/accounts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ label: `activity-${userId}` }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      `CDP wallet error ${res.status}: ${body?.error || JSON.stringify(body)}`
    );
  return { address: body.address as Hex };
}
