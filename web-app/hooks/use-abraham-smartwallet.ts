"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseEther,
  formatEther,
  type PublicClient,
} from "viem";
import { baseSepolia } from "@/lib/base-sepolia";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useAbrahamStaking } from "./use-abraham-staking";
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
  showWarningToast,
} from "@/lib/error-utils";

/* ------------------------------------------------------------------ */
/*                        CONTRACT ADDRESS                             */
/* ------------------------------------------------------------------ */
export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_ABRAHAM_ADDRESS as `0x${string}`) ??
  "0xd442F8B7A223e35A9b98E02a9c5Ddbe0D288659E";

type BatchedCall = {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint;
};

export function useAbrahamSmartWallet() {
  const { stakedBalance, stake, fetchStakedBalance } = useAbrahamStaking();
  /* ---------- public client ---------- */
  const publicClient: PublicClient = useMemo(
    () =>
      createPublicClient({
        chain: baseSepolia,
        transport: http(baseSepolia.rpcUrls.default.http[0]),
      }),
    []
  );

  /* ---------- privy smart wallet client ---------- */
  const { user } = usePrivy();
  const { client, getClientForChain } = useSmartWallets();
  const [swClient, setSwClient] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!client) return setSwClient(null);
      // Ensure we use Base Sepolia smart-wallet client when available
      const c = (await getClientForChain?.({ id: baseSepolia.id })) ?? client;
      setSwClient(c);
    })();
  }, [client, getClientForChain]);

  const smartWalletAddress = user?.linkedAccounts?.find(
    (a) => a.type === "smart_wallet" && "address" in a
  )?.address as `0x${string}` | undefined;

  /* ---------- batching queue ---------- */
  const queueRef = useRef<BatchedCall[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wait for the smart wallet client to be ready (handles init races)
  const ensureSmartClient = async (timeoutMs = 8000) => {
    const start = Date.now();
    // Try to get a chain-specific client if possible
    while (true) {
      if (swClient) return swClient;
      await new Promise((r) => setTimeout(r, 150));
      if (Date.now() - start > timeoutMs) {
        const err = new Error("Smart wallet still initializing");
        showErrorToast(err, "Wallet Not Ready");
        throw err;
      }
    }
  };

  const flush = async () => {
    const calls = queueRef.current;
    queueRef.current = [];
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!calls.length) return null;

    // 🔧 Wait for client readiness instead of throwing
    const clientToUse = await ensureSmartClient();

    // You still need *value* funds for payable calls (gas can be sponsored separately)
    if (smartWalletAddress) {
      const totalValue = calls.reduce(
        (acc, c) => acc + (c.value ?? BigInt(0)),
        BigInt(0)
      );
      const bal = await publicClient.getBalance({
        address: smartWalletAddress,
      });
      if (bal < totalValue) {
        const err = new Error("Insufficient funds for call value");
        showErrorToast(err, "Insufficient Balance");
        throw err;
      }
    }

    // You still need *value* funds for payable calls (gas can be sponsored separately)
    const totalValueNeeded = calls.reduce(
      (sum, call) => sum + (call.value ?? BigInt(0)),
      BigInt(0)
    );

    // One approval for all calls (atomic batch)
    const txHash = await clientToUse.sendTransaction(
      { calls },
      {
        uiOptions: {
          // Belt & suspenders: ensure no modal even if provider default changes
          showWalletUIs: false,
          title: `Sending ${calls.length} action(s)`,
          description: "Batched Abraham actions",
          buttonText: "Confirm",
        },
      }
    );

    try {
      const rcpt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      if (rcpt.status === "success") {
        // Create detailed success message based on calls count
        const actionDescription = `${calls.length} action${
          calls.length > 1 ? "s" : ""
        }`;

        showSuccessToast(
          `Sent ${actionDescription}`,
          `Transaction confirmed on-chain`
        );
      } else {
        const err = new Error("Transaction failed on-chain");
        showErrorToast(err, `Transaction Failed`);
        throw err;
      }
      return txHash;
    } catch (e: any) {
      // Handle any errors that occur during transaction confirmation
      if (!isUserReject(e)) {
        showErrorToast(e, "Transaction Failed");
      }
      throw e;
    }
  };

  const enqueue = (call: BatchedCall, { immediate = false } = {}) => {
    queueRef.current.push(call);
    if (immediate) {
      return flush().catch((e) => {
        // Make sure we catch flush errors here to prevent unhandled rejections
        if (!isUserReject(e)) {
          console.error("Error in immediate flush:", e);
          // The showErrorToast is already handled in flush() so no need to duplicate
        }
        throw e;
      });
    }
    if (!timerRef.current) {
      // coalesce bursts to really batch (single user op)
      timerRef.current = setTimeout(() => {
        flush().catch((e) => {
          if (!isUserReject(e)) {
            console.error("Error in delayed flush:", e);
            // Error toast already shown in flush()
          }
        });
      }, 1200);
    }
  };

  // Get staking requirements from contract
  const getStakingRequirements = async () => {
    try {
      const [praiseReq, blessReq] = await Promise.all([
        publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: AbrahamAbi,
          functionName: "praiseRequirement",
        }),
        publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: AbrahamAbi,
          functionName: "blessRequirement",
        }),
      ]);
      return {
        praise: praiseReq as bigint,
        bless: blessReq as bigint,
      };
    } catch (error) {
      console.error("Error fetching staking requirements:", error);
      return {
        praise: parseEther("10"), // 10 ABRAHAM
        bless: parseEther("20"), // 20 ABRAHAM
      };
    }
  };

  // Get available stake (total staked - linked to other creations)
  const getAvailableStake = async (userAddress: string) => {
    try {
      const [totalStaked, totalLinked] = await Promise.all([
        publicClient
          .readContract({
            address: CONTRACT_ADDRESS,
            abi: AbrahamAbi,
            functionName: "staking",
          })
          .then((stakingAddress) =>
            publicClient.readContract({
              address: stakingAddress as `0x${string}`,
              abi: [
                {
                  inputs: [
                    { internalType: "address", name: "user", type: "address" },
                  ],
                  name: "stakedBalance",
                  outputs: [
                    { internalType: "uint256", name: "", type: "uint256" },
                  ],
                  stateMutability: "view",
                  type: "function",
                },
              ],
              functionName: "stakedBalance",
              args: [userAddress as `0x${string}`],
            })
          ),
        publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: AbrahamAbi,
          functionName: "getUserTotalLinked",
          args: [userAddress as `0x${string}`],
        }),
      ]);

      const availableStake = (totalStaked as bigint) - (totalLinked as bigint);
      return availableStake > BigInt(0) ? availableStake : BigInt(0);
    } catch (error) {
      console.error("Error fetching available stake:", error);
      // If we can't determine linked stake, assume all stake is available
      const currentStaked = stakedBalance
        ? parseEther(stakedBalance)
        : BigInt(0);
      return currentStaked;
    }
  };

  // Check if user has enough available stake and stake more if needed
  // Now checks available stake (total - linked) instead of just total staked
  const ensureStaking = async (
    requiredAmount: bigint,
    actionType: "praise" | "bless"
  ) => {
    if (!smartWalletAddress) {
      throw new Error("Smart wallet address not available");
    }

    const availableStake = await getAvailableStake(smartWalletAddress);

    if (availableStake < requiredAmount) {
      const deficit = requiredAmount - availableStake;

      const confirmed = window.confirm(
        availableStake === BigInt(0)
          ? `You need ${formatEther(
              requiredAmount
            )} ABRAHAM staked to ${actionType}. Would you like to stake now?`
          : `You have ${formatEther(
              availableStake
            )} ABRAHAM available but need ${formatEther(
              requiredAmount
            )} to ${actionType}. Your other staked tokens are linked to other creations. Would you like to stake ${formatEther(
              deficit
            )} more ABRAHAM?`
      );

      if (!confirmed) {
        throw new Error("Insufficient staking for this action");
      }

      showWarningToast(
        "Staking Required",
        `Staking ${formatEther(deficit)} ABRAHAM tokens...`
      );

      await stake(deficit);
      await fetchStakedBalance();
    }
  };

  const isUserReject = (e: any) =>
    typeof e?.message === "string" &&
    e.message.toLowerCase().includes("user rejected");

  /* ------------------------------------------------------------------ */
  /*                             SINGLE ACTIONS (QUEUED)                */
  /* ------------------------------------------------------------------ */

  /** Queue a Praise (requires staking). */
  const praise = async (
    sessionUuid: string,
    messageUuid: string,
    opts?: { immediate?: boolean }
  ) => {
    try {
      const requirements = await getStakingRequirements();
      await ensureStaking(requirements.praise, "praise");

      const data = encodeFunctionData({
        abi: AbrahamAbi,
        functionName: "praise",
        args: [sessionUuid, messageUuid],
      });
      enqueue(
        { to: CONTRACT_ADDRESS, data }, // No value needed anymore
        { immediate: !!opts?.immediate }
      );

      // If immediate is true, the toast will be shown after flush()
      // otherwise, just show a queuing notification
      if (!opts?.immediate) {
        showInfoToast(
          "Praise queued",
          "Praise action added to batch. Will be sent shortly."
        );
      }
    } catch (e: any) {
      if (!isUserReject(e)) showErrorToast(e, "Praise Failed");
      throw e;
    }
  };

  /** Queue a Bless (pins JSON to IPFS first, requires staking). */
  const bless = async (
    sessionUuid: string,
    content: string,
    opts?: { immediate?: boolean }
  ) => {
    const trimmed = (content ?? "").trim();
    if (!trimmed) {
      const err = new Error("Content required");
      showErrorToast(err, "Content required");
      throw err;
    }

    const msgUuid = crypto.randomUUID();

    try {
      const requirements = await getStakingRequirements();
      await ensureStaking(requirements.bless, "bless");
    } catch (e: any) {
      if (!isUserReject(e)) showErrorToast(e, "Blessing Failed");
      throw e;
    }

    // Server pins JSON; author = smart wallet (preferred) or fallback
    let cid: string;
    try {
      // Show info toast while pinning to IPFS
      showInfoToast("Preparing blessing", "Uploading content to IPFS...");

      const res = await fetch("/api/ipfs/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionUuid,
          messageId: msgUuid,
          content: trimmed,
          author: smartWalletAddress,
          kind: "blessing",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "IPFS pin failed");
      cid = data.cid as string;
      if (!cid) throw new Error("CID missing from server response");

      showSuccessToast(
        "Content uploaded",
        "Blessing content pinned to IPFS successfully"
      );
    } catch (e: any) {
      showErrorToast(e, "Failed to pin blessing to IPFS");
      throw e;
    }

    try {
      const data = encodeFunctionData({
        abi: AbrahamAbi,
        functionName: "bless",
        args: [sessionUuid, msgUuid, cid],
      });
      enqueue(
        { to: CONTRACT_ADDRESS, data }, // No value needed anymore
        { immediate: !!opts?.immediate }
      );

      // If immediate is true, the toast will be shown after flush()
      // otherwise, just show a queuing notification
      if (!opts?.immediate) {
        showInfoToast(
          "Blessing queued",
          "Blessing action added to batch. Will be sent shortly."
        );
      }
      return { msgUuid };
    } catch (e: any) {
      if (!isUserReject(e)) showErrorToast(e, "Blessing Failed");
      throw e;
    }
  };

  return {
    praise, // queued (batched)
    bless, // queued (batched)
    flushBatch: flush, // manual flush option for a "Send all" UI
    pendingCallsCount: () => queueRef.current.length,
  };
}
