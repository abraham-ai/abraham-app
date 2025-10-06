"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
  formatEther,
  encodeFunctionData,
  type PublicClient,
  type WalletClient,
} from "viem";
import { baseSepolia } from "@/lib/base-sepolia";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import { useAuth } from "@/context/auth-context";
import { useTxMode } from "@/context/tx-mode-context";
import { useAbrahamStaking } from "./use-abraham-staking";
import {
  showErrorToast,
  showSuccessToast,
  showWarningToast,
} from "@/lib/error-utils";

/* ------------------------------------------------------------------ */
/*                        CONTRACT ADDRESS                             */
/* ------------------------------------------------------------------ */
export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_ABRAHAM_ADDRESS as `0x${string}`) ??
  "0xd442F8B7A223e35A9b98E02a9c5Ddbe0D288659E";

/**
 * Read-/write helpers for the Abraham contract.
 * - Guards against wallet absence and insufficient balance.
 * - Includes single actions for users (praise/bless).
 * - All txs toast on success; rejections won’t spam errors.
 */
export function useAbrahamContract() {
  const { eip1193Provider, authState } = useAuth();
  const { isMiniApp } = useTxMode();
  const { stakedBalance, stake, fetchStakedBalance } = useAbrahamStaking();

  /* ---------- viem clients ---------- */
  const publicClient: PublicClient = useMemo(
    () =>
      createPublicClient({
        chain: baseSepolia,
        transport: http(baseSepolia.rpcUrls.default.http[0]),
      }),
    []
  );

  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);

  useEffect(() => {
    if (!eip1193Provider) {
      setWalletClient(null);
      return;
    }
    setWalletClient(
      createWalletClient({
        chain: baseSepolia,
        transport: custom(eip1193Provider),
      })
    );
  }, [eip1193Provider]);

  /* ---------- helpers ---------- */
  const requireWallet = async () => {
    if (!walletClient) {
      const err = new Error("Wallet not connected");
      showErrorToast(err, "Wallet not connected");
      throw err;
    }

    // Priority 1: Use authState wallet address (most reliable, already validated)
    if (authState.walletAddress) {
      return authState.walletAddress as `0x${string}`;
    }

    // Priority 2: Try provider directly
    if (eip1193Provider) {
      try {
        const accounts: string[] = await eip1193Provider.request({
          method: "eth_accounts",
        });
        if (accounts?.[0]) {
          return accounts[0] as `0x${string}`;
        }
      } catch (e) {
        console.warn("Failed to get accounts from provider:", e);
      }
    }

    // Priority 3: Try wallet client
    let accounts = await walletClient.getAddresses();
    if (!accounts?.length) {
      try {
        await (walletClient as any).request?.({
          method: "eth_requestAccounts",
        });
        accounts = await walletClient.getAddresses();
      } catch {}
    }

    if (!accounts?.length) {
      const err = new Error("No account found");
      showErrorToast(err, "Wallet not connected");
      throw err;
    }
    return accounts[0]!;
  };

  const ensureChain = async () => {
    try {
      await (walletClient as any)?.switchChain?.({ id: baseSepolia.id });
    } catch {}
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
      // Fallback to default values from contract
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
    const sender = await requireWallet();
    console.log("[Contract] ensureStaking called:", {
      sender,
      requiredAmount: formatEther(requiredAmount),
      actionType,
      isMiniApp,
    });

    const availableStake = await getAvailableStake(sender);
    console.log("[Contract] Available stake:", {
      available: formatEther(availableStake),
      required: formatEther(requiredAmount),
    });

    if (availableStake < requiredAmount) {
      const deficit = requiredAmount - availableStake;
      console.log(
        "[Contract] Insufficient stake, need to stake:",
        formatEther(deficit)
      );

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

      try {
        console.log("[Contract] Calling stake function...");
        await stake(deficit);
        await fetchStakedBalance();
        console.log("[Contract] Staking completed successfully");
        showSuccessToast(
          "Staking Complete",
          `Successfully staked ${formatEther(deficit)} ABRAHAM`
        );
      } catch (error: any) {
        console.error("[Contract] Staking error:", error);
        // If staking fails, show error and re-throw
        if (!error?.message?.toLowerCase().includes("user rejected")) {
          showErrorToast(error, "Staking failed. Cannot proceed with action.");
        }
        throw error;
      }
    } else {
      console.log(
        "[Contract] Sufficient stake available, proceeding with action"
      );
    }
  };

  const waitAndToast = async (hash: `0x${string}`, msg: string) => {
    const rcpt = await publicClient.waitForTransactionReceipt({ hash });
    if (rcpt.status === "success") {
      showSuccessToast(msg, "Transaction confirmed on-chain.");
    } else {
      throw new Error("Transaction failed");
    }
  };

  const isUserReject = (e: any) =>
    typeof e?.message === "string" &&
    e.message.toLowerCase().includes("user rejected");

  /* ------------------------------------------------------------------ */
  /*                             SINGLE ACTIONS                          */
  /* ------------------------------------------------------------------ */

  /** Praise any message (requires staking). */
  const praise = async (sessionUuid: string, messageUuid: string) => {
    const sender = await requireWallet();
    const requirements = await getStakingRequirements();
    await ensureStaking(requirements.praise, "praise");

    try {
      // In Mini App, use provider directly (host controls chain)
      if (isMiniApp && eip1193Provider) {
        // Use provider directly for better Mini App compatibility
        const data = encodeFunctionData({
          abi: AbrahamAbi,
          functionName: "praise",
          args: [sessionUuid, messageUuid],
        });
        const hash = (await eip1193Provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: sender,
              to: CONTRACT_ADDRESS,
              data,
            },
          ],
        })) as `0x${string}`;
        await waitAndToast(hash, "Praise sent! 🙌");
        return hash;
      } else {
        // Regular Privy wallet flow
        await ensureChain();
        const hash = await walletClient!.writeContract({
          account: sender,
          address: CONTRACT_ADDRESS,
          abi: AbrahamAbi,
          functionName: "praise",
          args: [sessionUuid, messageUuid],
          chain: baseSepolia,
        });
        await waitAndToast(hash, "Praise sent! 🙌");
        return hash;
      }
    } catch (e: any) {
      if (!isUserReject(e)) showErrorToast(e, "Praise Failed");
      throw e;
    }
  };

  /** Bless = create IPFS JSON (server pins) then send CID on-chain. */
  const bless = async (sessionUuid: string, content: string) => {
    const trimmed = (content ?? "").trim();
    if (!trimmed) {
      showWarningToast("Missing Content", "Enter a message to bless.");
      return { msgUuid: "" };
    }

    const sender = await requireWallet();
    const requirements = await getStakingRequirements();
    await ensureStaking(requirements.bless, "bless");

    // 1) Pin to IPFS via server
    const msgUuid = crypto.randomUUID();
    const payload = {
      sessionId: sessionUuid,
      messageId: msgUuid,
      content: trimmed,
      author: sender,
      kind: "blessing",
    };

    const resp = await fetch("/api/ipfs/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to pin content");
    }
    const { cid } = await resp.json();

    // 2) Send on-chain
    try {
      // In Mini App, use provider directly (host controls chain)
      if (isMiniApp && eip1193Provider) {
        // Use provider directly for better Mini App compatibility
        const data = encodeFunctionData({
          abi: AbrahamAbi,
          functionName: "bless",
          args: [sessionUuid, msgUuid, cid],
        });
        const hash = (await eip1193Provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: sender,
              to: CONTRACT_ADDRESS,
              data,
            },
          ],
        })) as `0x${string}`;
        await waitAndToast(hash, "Blessing sent!");
        return { msgUuid };
      } else {
        // Regular Privy wallet flow
        await ensureChain();
        const hash = await walletClient!.writeContract({
          address: CONTRACT_ADDRESS,
          abi: AbrahamAbi,
          functionName: "bless",
          args: [sessionUuid, msgUuid, cid],
          account: sender,
          chain: baseSepolia,
        });
        await waitAndToast(hash, "Blessing sent!");
        return { msgUuid };
      }
    } catch (e: any) {
      if (!isUserReject(e)) showErrorToast(e, "Bless failed");
      throw e;
    }
  };

  return {
    praise,
    bless,
    getStakingRequirements,
    getAvailableStake,
    stakedBalance,
    fetchStakedBalance,
  };
}
