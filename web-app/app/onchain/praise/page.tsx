"use client";
import React, { Suspense } from "react";
// 1) The wrapper that Next.js sees as the "page" component
export default function PraiseWrapper() {
  return (
    <Suspense fallback={<div>Loading On-Chain Praise...</div>}>
      <PraisePage />
    </Suspense>
  );
}

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMannaTransactions } from "@/web-app/hooks/useMannaTransactions";

function PraisePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { makeReaction, getMannaBalance } = useMannaTransactions();
  const creationId = searchParams.get("creationId") || "";

  useEffect(() => {
    if (!creationId) {
      alert("No creationId provided!");
      router.push("/");
      return;
    }

    const doPraise = async () => {
      try {
        const cost = BigInt("1000000000000000000"); // 1 Manna

        // 1) Check user’s Manna balance
        const userBalance = await getMannaBalance();
        if (!userBalance) {
          alert("Error fetching Manna balance. Please try again.");
          router.push(`/frames/${creationId}`);
          return;
        }

        if (BigInt(userBalance) < cost) {
          alert("You don't have enough Manna to Praise!");
          router.push(`/frames/${creationId}`);
          return;
        }

        // 2) On-chain praise
        await makeReaction(parseInt(creationId, 10), "praise", "");
        alert("Praise transaction completed!");

        // 3) Redirect
        router.push(`/frames/${creationId}`);
      } catch (error) {
        console.error("Error praising creation:", error);
        alert("Error praising. Please try again.");
        router.push(`/frames/${creationId}`);
      }
    };

    doPraise();
  }, [creationId, router, makeReaction, getMannaBalance]);

  return (
    <div style={{ padding: "20px" }}>
      <h1>On-Chain Praise</h1>
      <p>Processing your transaction on chain...</p>
    </div>
  );
}
