import type { Address } from "viem";

export type Selector = `0x${string}`;

// function selectors used in Tier A
export const SELECTORS = {
  praise: "0x1d844710" as Selector, // placeholder; compute exact if needed
  bless: "0x00000000" as Selector, // not used; we check by contract+fn in server
  applyPatch: "0x00000000" as Selector,
};

export type AllowRule = {
  to: Address;
  selectors: Selector[] | "*";
  maxWeiPerTx?: bigint; // cap the value sent in msg.value
};

export type TierAPolicy = {
  chainId: number;
  allow: AllowRule[];
  maxWeiPerDay?: bigint;
};

// Load addresses from env
const ABRAHAM = process.env.NEXT_PUBLIC_ABRAHAM_ADDRESS as Address | undefined;
const PAYPATCH = process.env.NEXT_PUBLIC_PAYPATCH_ADDRESS as
  | Address
  | undefined;

export function getTierAPolicy(chainId: number): TierAPolicy {
  const allow: AllowRule[] = [];
  if (ABRAHAM) {
    // praise and bless are tiny payable
    allow.push({
      to: ABRAHAM,
      selectors: "*",
      maxWeiPerTx: BigInt("20000000000000"),
    });
  }
  if (PAYPATCH) {
    // applyPatch pays per byte; do not enforce per-tx wei cap here, rely on per-day cap
    allow.push({ to: PAYPATCH, selectors: "*" });
  }
  return { chainId, allow, maxWeiPerDay: BigInt("200000000000000") };
}

export function isAllowedTierA(
  policy: TierAPolicy,
  call: { to: Address; selector: Selector; valueWei: bigint }
): boolean {
  const rule = policy.allow.find(
    (r) => r.to.toLowerCase() === call.to.toLowerCase()
  );
  if (!rule) return false;
  if (rule.selectors !== "*" && !rule.selectors.includes(call.selector))
    return false;
  if (typeof rule.maxWeiPerTx === "bigint" && call.valueWei > rule.maxWeiPerTx)
    return false;
  // Note: per-day cap should be enforced server-side via storage; omitted here.
  return true;
}
