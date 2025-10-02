"use client";

import React, { useState } from "react";
import { SendIcon, Loader2Icon } from "lucide-react";
import { isAddress } from "viem";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAbrahamToken } from "@/hooks/use-abraham-token";
import { showErrorToast, showSuccessToast } from "@/lib/error-utils";

interface SendAbrahamTokensProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number | null;
  onTransactionComplete?: () => void;
}

export default function SendAbrahamTokens({
  open,
  onOpenChange,
  currentBalance,
  onTransactionComplete,
}: SendAbrahamTokensProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  
  const { transfer } = useAbrahamToken();

  const handleSend = async () => {
    // Validation
    if (!recipient.trim()) {
      showErrorToast(new Error("validation"), "Please enter a recipient address");
      return;
    }

    if (!isAddress(recipient.trim())) {
      showErrorToast(new Error("validation"), "Please enter a valid Ethereum address");
      return;
    }

    if (!amount.trim()) {
      showErrorToast(new Error("validation"), "Please enter an amount");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showErrorToast(new Error("validation"), "Please enter a valid amount greater than 0");
      return;
    }

    if (currentBalance !== null && amountNum > currentBalance) {
      showErrorToast(new Error("validation"), "Insufficient balance");
      return;
    }

    setSending(true);
    try {
      const success = await transfer(recipient.trim() as `0x${string}`, amountNum);
      
      if (success) {
        showSuccessToast(
          "Tokens sent successfully",
          `Sent ${amountNum.toLocaleString()} $ABRAHAM to ${recipient.slice(0, 6)}...${recipient.slice(-4)}`
        );
        
        // Reset form
        setRecipient("");
        setAmount("");
        onOpenChange(false);
        
        // Notify parent to refresh balances
        onTransactionComplete?.();
      }
    } catch (error) {
      showErrorToast(error as Error, "Failed to send tokens");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      setRecipient("");
      setAmount("");
      onOpenChange(false);
    }
  };

  const maxAmount = currentBalance || 0;
  const canSend = recipient.trim() && amount.trim() && !sending && isAddress(recipient.trim());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SendIcon className="w-5 h-5" />
            Send ABRAHAM Tokens
          </DialogTitle>
          <DialogDescription>
            Send $ABRAHAM tokens to another address using MetaMask.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient Address */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Address</Label>
            <Input
              id="recipient"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              disabled={sending}
              className="font-mono text-sm"
            />
            {recipient.trim() && !isAddress(recipient.trim()) && (
              <p className="text-sm text-red-600">Invalid Ethereum address</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($ABRAHAM)</Label>
            <div className="space-y-2">
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                disabled={sending}
                min="0"
                step="0.000001"
                max={maxAmount}
              />
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Available: {currentBalance?.toLocaleString() || 0} $ABRAHAM</span>
                {currentBalance && currentBalance > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(currentBalance.toString())}
                    disabled={sending}
                    className="text-xs h-6"
                  >
                    Max
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Transaction Summary */}
          {amount && parseFloat(amount) > 0 && isAddress(recipient.trim()) && (
            <div className="bg-gray-50 p-3 rounded-lg space-y-1">
              <h4 className="font-medium text-sm">Transaction Summary</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>To:</span>
                  <span className="font-mono text-xs">
                    {recipient.slice(0, 6)}...{recipient.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Amount:</span>
                  <span className="font-medium">
                    {parseFloat(amount).toLocaleString()} $ABRAHAM
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend}
            className="flex items-center gap-2"
          >
            {sending && <Loader2Icon className="w-4 h-4 animate-spin" />}
            {sending ? "Sending..." : "Send Tokens"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}