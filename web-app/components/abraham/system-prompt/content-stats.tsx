"use client";

import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface ContentStatsProps {
  draft: string;
  chainText: string;
}

export function ContentStats({ draft, chainText }: ContentStatsProps) {
  return (
    <Card className="p-4 border border-gray-200 rounded-lg">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-100 border border-gray-400 rounded-sm flex items-center justify-center">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">Content</div>
            <div className="text-xs text-gray-500">Document stats</div>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Characters</span>
            <span className="font-mono">{draft.length}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600">Original</span>
            <span className="font-mono">{chainText.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Change</span>
            <span
              className={`font-mono ${
                draft.length > chainText.length
                  ? "text-green-600"
                  : draft.length < chainText.length
                  ? "text-red-600"
                  : "text-gray-600"
              }`}
            >
              {draft.length > chainText.length ? "+" : ""}
              {draft.length - chainText.length}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
