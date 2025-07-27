"use client";

import { useEffect, useState } from "react";
import { usePromptContract } from "@/hooks/use-prompt-contract";

export default function PromptEditor() {
  const { fetchText, savePrompt } = usePromptContract();

  // on‑chain value + local draft
  const [chainText, setChainText] = useState("");
  const [draft, setDraft] = useState("");

  // ui flags
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // one‑shot load
  useEffect(() => {
    (async () => {
      const txt = await fetchText();
      setChainText(txt);
      setDraft(txt);
      setLoading(false);
    })();
  }, []); //  ← empty deps = only once

  useEffect(() => {
    console.log("Draft updated:", draft);
    console.log("Chain text:", chainText);
    console.log("Saving state:", saving);
  }, [draft, saving, chainText]); // log changes

  const dirty = draft !== chainText;

  const handleSave = async () => {
    if (!dirty) return; // nothing to do
    setSaving(true);
    try {
      await savePrompt(chainText, draft); // old, new
      setChainText(draft); // local cache = on‑chain now
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="p-8">Loading…</p>;

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <textarea
        className="w-full h-96 p-4 border rounded"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />

      <button
        disabled={saving || !dirty}
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 text-white rounded
                   disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </main>
  );
}
