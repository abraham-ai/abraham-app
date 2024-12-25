// app/onchain/burn/page.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMannaTransactions } from "@/hooks/useMannaTransactions";

export default function BurnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { burn, getMannaBalance } = useMannaTransactions();

  const creationId = searchParams.get("creationId") || "";

  useEffect(() => {
    if (!creationId) {
      alert("No creationId provided!");
      router.push("/");
      return;
    }

    const doBurn = async () => {
      try {
        // For example, burn 2 Manna => 2e18
        const cost = BigInt("2000000000000000000");

        // 1) Refresh user balance
        const userBalance = await getMannaBalance();
        if (!userBalance) {
          alert("Error fetching your Manna balance. Please try again.");
          router.push(`/frames/${creationId}`);
          return;
        }
        const userBalanceBig = BigInt(userBalance.toString());

        // 2) Check if user has enough Manna
        if (userBalanceBig < cost) {
          alert("You do not have enough Manna to Burn this creation!");
          router.push(`/frames/${creationId}`);
          return;
        }

        // 3) Perform on-chain burn
        await burn(BigInt(creationId), cost);
        alert("Burn transaction complete!");

        // 4) redirect
        router.push(`/frames/${creationId}`);
      } catch (error) {
        console.error("Error burning creation:", error);
        alert("Error burning creation. Please try again.");
        router.push(`/frames/${creationId}`);
      }
    };

    doBurn();
  }, [creationId, burn, router, getMannaBalance]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Burning Creation {creationId} On-Chain...</h1>
      <p>Please wait, completing your transaction.</p>
    </div>
  );
}
