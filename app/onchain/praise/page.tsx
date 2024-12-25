// app/onchain/praise/page.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMannaTransactions } from "@/hooks/useMannaTransactions";

export default function PraisePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { praise, getMannaBalance, balance } = useMannaTransactions();

  const creationId = searchParams.get("creationId") || "";

  useEffect(() => {
    if (!creationId) {
      alert("No creationId provided!");
      router.push("/");
      return;
    }

    const doPraise = async () => {
      try {
        // For example, praising with 1 Manna => 1e18 wei
        const cost = BigInt("1000000000000000000");

        // 1) Refresh user balance
        const userBalance = await getMannaBalance(); // returns BigInt or string
        if (!userBalance) {
          alert("Error fetching your Manna balance. Please try again.");
          router.push(`/frames/${creationId}`);
          return;
        }
        // Convert if needed
        const userBalanceBig = BigInt(userBalance.toString());

        // 2) Check if user has enough Manna
        if (userBalanceBig < cost) {
          alert("You do not have enough Manna to Praise!");
          router.push(`/frames/${creationId}`);
          return;
        }

        // 3) Execute on-chain praise
        await praise(BigInt(creationId), cost);
        alert("Praise transaction complete!");

        // 4) Redirect back to the frame
        router.push(`/frames/${creationId}`);
      } catch (error) {
        console.error("Error praising creation:", error);
        alert("Error praising. Please try again.");
        router.push(`/frames/${creationId}`);
      }
    };

    doPraise();
  }, [creationId, praise, router, getMannaBalance, balance]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Praising Creation {creationId} On-Chain...</h1>
      <p>Please wait, completing your transaction.</p>
    </div>
  );
}
