import { AbrahamCurationAbi } from "@/lib/abis/AbrahamCuration";
import { getPreferredChain } from "@/lib/chains";
import type { PublicClient } from "viem";

export const ABRAHAM_CURATION_ADDRESS =
  (process.env.NEXT_PUBLIC_ABRAHAM_CURATION_ADDRESS as `0x${string}`) ||
  ("0x685e9920314A5E6d052191c12420143F46834cA5" as `0x${string}`);

export const AbrahamCuration = {
  address: ABRAHAM_CURATION_ADDRESS,
  abi: AbrahamCurationAbi,
  chain: getPreferredChain(),
} as const;

export async function readRemainingCredits(
  publicClient: PublicClient,
  stakeHolder: `0x${string}`
) {
  const [credits, capacity] = (await publicClient.readContract({
    address: AbrahamCuration.address,
    abi: AbrahamCuration.abi,
    functionName: "remainingCredits",
    args: [stakeHolder],
  })) as unknown as [bigint, bigint];
  return { credits, capacity };
}

export async function readIsDelegateApproved(
  publicClient: PublicClient,
  stakeHolder: `0x${string}`,
  delegate: `0x${string}`
) {
  const approved = (await publicClient.readContract({
    address: AbrahamCuration.address,
    abi: AbrahamCuration.abi,
    functionName: "isDelegateApproved",
    args: [stakeHolder, delegate],
  })) as boolean;
  return approved;
}
