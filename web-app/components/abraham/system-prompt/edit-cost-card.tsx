"use client";

import { Card } from "@/components/ui/card";
import { Coins } from "lucide-react";
import { buildPatch } from "@/lib/patch";

interface EditCostCardProps {
  pricePerByteEth: string;
  loadingPrice: boolean;
  dirty: boolean;
  chainText: string;
  draft: string;
  editCostEth: string;
}

export function EditCostCard({
  pricePerByteEth,
  loadingPrice,
  dirty,
  chainText,
  draft,
  editCostEth,
}: EditCostCardProps) {
  return (
    <Card className="p-4 border border-gray-200 rounded-lg">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 border border-green-400 rounded-sm flex items-center justify-center">
            <Coins className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">Edit Cost</div>
            <div className="text-xs text-gray-500">Transaction fees</div>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Price/byte</span>
            <span className="font-mono text-xs">
              {loadingPrice ? "..." : `${pricePerByteEth.slice(0, 8)} ETH`}
            </span>
          </div>
          {dirty && (
            <div className="flex justify-between">
              <span className="text-gray-600">Bytes changed</span>
              <span className="font-mono">
                {(() => {
                  try {
                    const { changed } = buildPatch(chainText, draft);
                    return changed;
                  } catch {
                    return "—";
                  }
                })()}
              </span>
            </div>
          )}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-900">Total</span>
              <span className="font-mono font-bold text-lg">
                {editCostEth} ETH
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
