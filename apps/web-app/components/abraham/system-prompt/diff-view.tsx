"use client";

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronRight, GitBranch } from "lucide-react";

interface DiffLine {
  type: "unchanged" | "added" | "removed";
  content: string;
  lineNumber: number;
}

interface DiffViewProps {
  chainText: string;
  draft: string;
  dirty: boolean;
}

export function DiffView({ chainText, draft, dirty }: DiffViewProps) {
  const [showDiff, setShowDiff] = useState(false);
  const diffContainerRef = useRef<HTMLDivElement>(null);

  // Calculate diff for display
  const calculateDiff = (oldText: string, newText: string): DiffLine[] => {
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    const diff: DiffLine[] = [];

    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || "";
      const newLine = newLines[i] || "";

      if (oldLine === newLine) {
        diff.push({ type: "unchanged", content: oldLine, lineNumber: i + 1 });
      } else {
        // If oldLine exists and is different, it's removed
        if (oldLine !== "") {
          diff.push({ type: "removed", content: oldLine, lineNumber: i + 1 });
        }
        // If newLine exists and is different, it's added
        if (newLine !== "") {
          diff.push({ type: "added", content: newLine, lineNumber: i + 1 });
        }
      }
    }

    return diff;
  };

  const diffData = dirty ? calculateDiff(chainText, draft) : [];

  // Scroll to the last diff area when expanded
  useEffect(() => {
    if (showDiff && diffContainerRef.current) {
      const diffElements = diffContainerRef.current.querySelectorAll(
        ".diff-line.bg-green-50, .diff-line.bg-red-50"
      );
      const lastDiffElement = diffElements[diffElements.length - 1] as
        | HTMLElement
        | undefined;

      if (lastDiffElement) {
        lastDiffElement.scrollIntoView({ behavior: "smooth", block: "end" }); // Scroll to the end of the element
      }
    }
  }, [showDiff, diffData]); // Re-run if diffData changes to ensure correct scroll target

  if (!dirty) return null;

  return (
    <Card className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setShowDiff(!showDiff)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 border border-orange-400 rounded-sm  flex items-center justify-center">
              <GitBranch className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Changes</div>
              <div className="text-xs text-gray-500">
                {diffData.filter((d) => d.type === "added").length} additions,{" "}
                {diffData.filter((d) => d.type === "removed").length} deletions
              </div>
            </div>
            {showDiff ? (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
      </div>
      {showDiff && (
        <div
          ref={diffContainerRef}
          className="border-t border-gray-100 bg-gray-50 max-h-36 overflow-y-auto" // max-h-40 for approx 4 lines (160px)
        >
          <div className="font-mono text-xs overflow-x-auto">
            {" "}
            {/* Added overflow-x-auto here */}
            {diffData.map((line, index) => (
              <div
                key={index}
                className={`flex diff-line ${
                  line.type === "added"
                    ? "bg-green-50 text-green-800"
                    : line.type === "removed"
                    ? "bg-red-50 text-red-800"
                    : "bg-white text-gray-600"
                }`}
              >
                <div className="w-12 px-2 py-1 text-gray-400 bg-gray-100 border-r border-gray-200 text-right flex-shrink-0">
                  {line.lineNumber}
                </div>
                <div className="w-6 px-1 py-1 text-center font-bold flex-shrink-0">
                  {line.type === "added"
                    ? "+"
                    : line.type === "removed"
                    ? "-"
                    : " "}
                </div>
                <div className="flex-1 px-2 py-1 whitespace-pre flex-shrink-0">
                  {" "}
                  {/* Changed to whitespace-pre */}
                  {line.content || " "}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
