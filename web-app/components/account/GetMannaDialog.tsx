"use client";
import React, { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMannaTransactions } from "@/hooks/legacy/useMannaTransactions";
import { useManna } from "@/context/legacy/MannaContext";
import { Loader2Icon } from "lucide-react";

export function GetMannaDialog() {
  const { buyManna } = useMannaTransactions();
  const { getMannaBalance } = useManna(); // Use the shared getMannaBalance
  const [mannaAmount, setMannaAmount] = useState("100"); // Default Manna amount
  const [etherCost, setEtherCost] = useState("0.001"); // Default Ether cost
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Update Ether cost when Manna amount changes
  const handleMannaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMannaAmount(value);

    // Calculate Ether cost
    if (value && !isNaN(Number(value))) {
      const ether = calculateEtherForManna(value);
      setEtherCost(ether);
    } else {
      setEtherCost("0");
    }
  };

  const handleBuyManna = async () => {
    if (
      !mannaAmount ||
      isNaN(Number(mannaAmount)) ||
      Number(mannaAmount) <= 0
    ) {
      alert("Please enter a valid Manna amount.");
      return;
    }
    try {
      setIsLoading(true);
      // Calculate the Ether amount required
      const etherAmount = calculateEtherForManna(mannaAmount);
      await buyManna(etherAmount);
      await getMannaBalance(); // Refresh the shared balance
      //alert("Successfully purchased Manna tokens!");
      setIsDialogOpen(false); // Close the dialog
    } catch (error) {
      console.error("Error buying Manna:", error);
      alert("Transaction failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <button
          className="border rounded-lg py-1 px-4 ml-auto"
          onClick={() => setIsDialogOpen(true)}
        >
          Get Manna
        </button>
      </DialogTrigger>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>Get Manna</DialogTitle>
          <DialogDescription>
            Enter the amount of Manna you want to purchase.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Manna Amount</label>
            <Input
              type="number"
              value={mannaAmount}
              onChange={handleMannaChange}
              min="1"
              className="mt-1"
              disabled={isLoading}
            />
          </div>
          <div>
            <p>
              This will cost approximately <strong>{etherCost}</strong> ETH.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleBuyManna}
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2Icon className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              "Buy Manna"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function calculateEtherForManna(value: string): string {
  // Implement the logic to calculate Ether cost based on Manna amount
  const etherCost = Number(value) * 0.0001; // Example conversion rate
  return etherCost.toFixed(4); // Return as a string with 4 decimal places
}
