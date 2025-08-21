"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2 } from "lucide-react";
import { buildPatch } from "@/lib/patch";

interface PromptEditorProps {
  draft: string;
  setDraft: (value: string) => void;
  chainText: string;
  dirty: boolean;
  saving: boolean;
  loadingAuth: boolean;
  canAfford: boolean;
  loggedIn: boolean;
  editCostEth: string;
  handleSave: () => void;
}

export function PromptEditor({
  draft,
  setDraft,
  chainText,
  dirty,
  saving,
  loadingAuth,
  canAfford,
  loggedIn,
  editCostEth,
  handleSave,
}: PromptEditorProps) {
  return (
    <div className="flex flex-col h-full space-y-4">
      <Textarea
        className="flex-1 resize-none border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:border-blue-300 focus:ring-1 focus:ring-blue-300 transition-all"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Enter your system prompt here..."
      />

      {/* Editor Stats Row */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <span>{draft.length} characters</span>
          <span>•</span>
          <span>{new Blob([draft]).size} bytes</span>
          {dirty && (
            <>
              <span>•</span>
              <span className="text-blue-600">
                {(() => {
                  try {
                    const { changed } = buildPatch(chainText, draft);
                    return `${changed} bytes changed`;
                  } catch {
                    return "calculating...";
                  }
                })()}
              </span>
            </>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={!dirty || saving || loadingAuth || !canAfford || !loggedIn}
          className="rounded-md px-12"
          size="sm"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
