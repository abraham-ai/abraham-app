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
import { getPreferredChain } from "@/lib/chains";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import { AbrahamTokenAbi } from "@/lib/abis/AbrahamToken";
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

export const TOKEN_ADDRESS =
  (process.env.NEXT_PUBLIC_ABRAHAM_TOKEN_ADDRESS as `0x${string}`) ??
  "0x8e10Dee16186E7F2CEAE6ea0F02C88ab56D23722";

export const STAKING_ADDRESS =
  (process.env.NEXT_PUBLIC_ABRAHAM_STAKING_ADDRESS as `0x${string}`) ??
  "0xb823C0Eec6Dc6155DE3288695eD132eC2F8e477a";

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
        chain: getPreferredChain(),
        transport: http(getPreferredChain().rpcUrls.default.http[0]),
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
      const c =
        (await getClientForChain?.({ id: getPreferredChain().id })) ?? client;
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

    // Ensure we have the smart wallet address
    if (!smartWalletAddress) {
      const err = new Error(
        "Smart wallet address not available for transaction"
      );
      console.error("[Smart Wallet] Cannot send transaction without address");
      showErrorToast(err, "Smart Wallet Not Ready");
      throw err;
    }

    console.log("[Smart Wallet] Sending transaction:", {
      calls: calls.length,
      account: smartWalletAddress,
    });

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
      const err = new Error("Smart wallet address not available");
      console.error("[Smart Wallet] No smart wallet address found:", {
        user,
        smartWalletAddress,
        linkedAccounts: user?.linkedAccounts,
      });
      showErrorToast(err, "Smart Wallet Not Found");
      throw err;
    }

    console.log("[Smart Wallet] Checking stake for:", {
      address: smartWalletAddress,
      requiredAmount: formatEther(requiredAmount),
      actionType,
    });

    let availableStake: bigint;
    try {
      availableStake = await getAvailableStake(smartWalletAddress);
      console.log("[Smart Wallet] Available stake:", {
        available: formatEther(availableStake),
        required: formatEther(requiredAmount),
      });
    } catch (error) {
      console.error("[Smart Wallet] Error getting available stake:", error);
      showErrorToast(
        error,
        "Failed to check staking balance. Please try again."
      );
      throw error;
    }

    if (availableStake < requiredAmount) {
      const deficit = requiredAmount - availableStake;

      // Inform user about staking requirement and proceed automatically
      showWarningToast(
        "Staking Required",
        availableStake === BigInt(0)
          ? `Staking ${formatEther(requiredAmount)} ABRAHAM to ${actionType}...`
          : `You have ${formatEther(
              availableStake
            )} ABRAHAM available but need ${formatEther(
              requiredAmount
            )}. Staking ${formatEther(deficit)} more...`
      );

      console.log("[Smart Wallet] Initiating stake:", {
        deficit: formatEther(deficit),
      });

      try {
        await stakeWithSmartWallet(deficit);
        await fetchStakedBalance();

        // Re-check available stake after staking
        const newAvailableStake = await getAvailableStake(smartWalletAddress);
        console.log("[Smart Wallet] New available stake after staking:", {
          available: formatEther(newAvailableStake),
        });

        showSuccessToast(
          "Staking Complete",
          `Successfully staked ${formatEther(deficit)} ABRAHAM`
        );
      } catch (error: any) {
        // If staking fails, show error and re-throw
        if (!error?.message?.toLowerCase().includes("user rejected")) {
          showErrorToast(error, "Staking failed. Cannot proceed with action.");
        }
        throw error;
      }
    }
  };

  const isUserReject = (e: any) =>
    typeof e?.message === "string" &&
    e.message.toLowerCase().includes("user rejected");

  /* ------------------------------------------------------------------ */
  /*                         SMART WALLET STAKING                        */
  /* ------------------------------------------------------------------ */

  /**
   * Stake tokens using smart wallet.
   * Uses transferAndCall on the ABRAHAM token contract to stake in one transaction.
   */
  const stakeWithSmartWallet = async (amount: bigint) => {
    if (!smartWalletAddress) {
      const err = new Error("Smart wallet address not available");
      console.error("[Smart Wallet] Cannot stake without smart wallet address");
      showErrorToast(err, "Smart Wallet Not Found");
      throw err;
    }

    console.log("[Smart Wallet] Staking:", {
      amount: formatEther(amount),
      smartWalletAddress,
    });

    // Check if user has enough ABRAHAM tokens
    let tokenBalance: bigint;
    try {
      tokenBalance = (await publicClient.readContract({
        address: TOKEN_ADDRESS,
        abi: AbrahamTokenAbi,
        functionName: "balanceOf",
        args: [smartWalletAddress],
      })) as bigint;

      console.log("[Smart Wallet] Token balance:", {
        balance: formatEther(tokenBalance),
        needed: formatEther(amount),
      });

      if (tokenBalance < amount) {
        const err = new Error(
          `Insufficient ABRAHAM balance. You have ${formatEther(
            tokenBalance
          )} but need ${formatEther(amount)}`
        );
        showErrorToast(err, "Insufficient Balance");
        throw err;
      }
    } catch (error) {
      console.error("[Smart Wallet] Error checking token balance:", error);
      throw error;
    }

    // Encode transferAndCall to stake
    const data = encodeFunctionData({
      abi: AbrahamTokenAbi,
      functionName: "transferAndCall",
      args: [STAKING_ADDRESS, amount, "0x"],
    });

    // Wait for client readiness
    const clientToUse = await ensureSmartClient();

    try {
      console.log("[Smart Wallet] Sending stake transaction...");
      const txHash = await clientToUse.sendTransaction(
        {
          calls: [{ to: TOKEN_ADDRESS, data }],
        },
        {
          uiOptions: {
            showWalletUIs: false,
            title: "Staking ABRAHAM",
            description: `Staking ${formatEther(amount)} ABRAHAM tokens`,
            buttonText: "Confirm",
          },
        }
      );

      console.log("[Smart Wallet] Stake transaction sent:", txHash);

      const rcpt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (rcpt.status === "success") {
        showSuccessToast(
          "Staking Successful",
          `Staked ${formatEther(amount)} ABRAHAM tokens`
        );
        return txHash;
      } else {
        const err = new Error("Staking transaction failed");
        showErrorToast(err, "Staking Failed");
        throw err;
      }
    } catch (e: any) {
      console.error("[Smart Wallet] Staking error:", e);
      if (!isUserReject(e)) {
        showErrorToast(e, "Staking Failed");
      }
      throw e;
    }
  };

  /* ------------------------------------------------------------------ */
  /*                             SINGLE ACTIONS (QUEUED)                */
  /* ------------------------------------------------------------------ */

  /** Queue a Praise (requires staking). */
  const praise = async (
    sessionUuid: string,
    messageUuid: string,
    opts?: { immediate?: boolean }
  ) => {
    console.log("[Smart Wallet] Praise called:", {
      sessionUuid,
      messageUuid,
      immediate: opts?.immediate,
      smartWalletAddress,
    });
    try {
      const requirements = await getStakingRequirements();
      console.log("[Smart Wallet] Praise requirements:", {
        required: formatEther(requirements.praise),
      });
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
    console.log("[Smart Wallet] Bless called:", {
      sessionUuid,
      contentLength: content?.length,
      immediate: opts?.immediate,
      smartWalletAddress,
    });

    const trimmed = (content ?? "").trim();
    if (!trimmed) {
      const err = new Error("Content required");
      showErrorToast(err, "Content required");
      throw err;
    }

    const msgUuid = crypto.randomUUID();

    try {
      const requirements = await getStakingRequirements();
      console.log("[Smart Wallet] Bless requirements:", {
        required: formatEther(requirements.bless),
      });
      await ensureStaking(requirements.bless, "bless");
    } catch (e: any) {
      console.error("[Smart Wallet] Bless staking check failed:", e);
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
