import React, { Suspense } from "react";

export default function BurnWrapper() {
  return (
    <Suspense fallback={<div>Loading On-Chain Burn...</div>}>
      <BurnPage />
    </Suspense>
  );
}

("use client");
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMannaTransactions } from "@/hooks/useMannaTransactions";

function BurnPage() {
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
        const cost = BigInt("2000000000000000000"); // e.g. 2 Manna

        // 1) Check user’s Manna
        const userBalance = await getMannaBalance();
        if (!userBalance) {
          alert("Error fetching Manna balance. Please try again.");
          router.push(`/frames/${creationId}`);
          return;
        }

        if (BigInt(userBalance) < cost) {
          alert("Not enough Manna to Burn!");
          router.push(`/frames/${creationId}`);
          return;
        }

        // 2) Burn transaction
        await burn(BigInt(1), cost);
        alert("Burn transaction completed!");

        // 3) redirect
        router.push(`/frames/${creationId}`);
      } catch (error) {
        console.error("Error burning creation:", error);
        alert("Error burning creation. Please try again.");
        router.push(`/frames/${creationId}`);
      }
    };

    doBurn();
  }, [creationId, burn, getMannaBalance, router]);

  return (
    <div style={{ padding: 20 }}>
      <h1>On-Chain Burn</h1>
      <p>Processing your transaction. Please wait...</p>
    </div>
  );
}
