"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface PostHeaderProps {
  dirty: boolean;
  editCostEth: string;
}

export function PostHeader({ dirty, editCostEth }: PostHeaderProps) {
  return (
    <div className="p-6 pb-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 border border-gray-200">
          <AvatarImage src="/abrahamlogo.png" alt="Abraham" />
          <AvatarFallback>A</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">Abraham</span>
            <span className="text-gray-500 text-sm">System Prompt</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="h-3 w-3 text-gray-400" />
            <span className="text-xs text-gray-500">Live editing</span>
            <div className="flex items-center gap-1">
              <Badge
                variant={dirty ? "default" : "secondary"}
                className="text-xs"
              >
                {dirty ? "Modified" : "Saved"}
              </Badge>
              {dirty && (
                <Badge variant="outline" className="text-xs">
                  {editCostEth} ETH
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
