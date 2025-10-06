"use client";

import { useMemo } from "react";
import { parseEther } from "viem";
import { useAbrahamToken } from "./use-abraham-token";
import { useAbrahamStaking } from "./use-abraham-staking";

/**
 * Hook to check if user has enough Abraham tokens (balance + stake) to perform actions.
 * Returns eligibility status and messages for praise and bless actions.
 */
export function useAbrahamEligibility() {
  const { balance } = useAbrahamToken();
  const { stakedBalance } = useAbrahamStaking();

  // Default staking requirements (same as in contracts)
  const PRAISE_REQUIREMENT = parseEther("10"); // 10 ABRAHAM
  const BLESS_REQUIREMENT = parseEther("20"); // 20 ABRAHAM

  const eligibility = useMemo(() => {
    // Parse current balances
    const currentBalance = balance ? parseEther(balance) : BigInt(0);
    const currentStaked = stakedBalance ? parseEther(stakedBalance) : BigInt(0);
    const totalAvailable = currentBalance + currentStaked;

    // Check praise eligibility
    const canPraise = totalAvailable >= PRAISE_REQUIREMENT;
    const praiseMessage = canPraise
      ? "Praise Creation (Requires staked ABRAHAM tokens)"
      : "Not enough $ABRAHAM";

    // Check bless eligibility
    const canBless = totalAvailable >= BLESS_REQUIREMENT;
    const blessMessage = canBless
      ? "Bless Creation (Requires staked ABRAHAM tokens)"
      : "Not enough $ABRAHAM";

    return {
      canPraise,
      canBless,
      praiseMessage,
      blessMessage,
      totalAvailable,
      balance: currentBalance,
      staked: currentStaked,
    };
  }, [balance, stakedBalance]);

  return eligibility;
}
