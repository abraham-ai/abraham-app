"use client";
import { useEffect, useState } from "react";
import { useMannaTransactions } from "@/hooks/legacy/useMannaTransactions";
import { useAuth } from "@/context/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Manna() {
  const { provider } = useAuth();
  const { getContractBalances } = useMannaTransactions();
  const [balances, setBalances] = useState({
    mannaBalance: "0",
    ethBalance: "0",
  });

  useEffect(() => {
    const fetchBalances = async () => {
      if (provider) {
        const contractBalances = await getContractBalances();
        if (contractBalances) {
          setBalances(contractBalances);
        }
      }
    };
    fetchBalances();
  }, [provider, getContractBalances]);

  return (
    <div className="flex justify-center items-center min-h-screen ">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Contract Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mt-4 space-y-4">
            <div className="text-lg font-semibold">
              Manna Token Balance:{" "}
              <span className="font-normal">{balances.mannaBalance}</span>
            </div>
            <div className="text-lg font-semibold">
              ETH Balance:{" "}
              <span className="font-normal">{balances.ethBalance}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
