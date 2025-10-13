"use client";

import { useEffect, useState } from "react";
import { usePromptContract } from "@/hooks/experimental/use-prompt-contract";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { formatEther, createPublicClient, http } from "viem";
import { buildPatch } from "@/lib/patch";
import { getPreferredChain } from "@/lib/chains";
import AppBar from "@/components/layout/AppBar";

// Import all the new components
import { PromptEditor } from "@/components/abraham/system-prompt/prompt-editor";
import { DiffView } from "@/components/abraham/system-prompt/diff-view";
import { ContentStats } from "@/components/abraham/system-prompt/content-stats";
import { EditCostCard } from "@/components/abraham/system-prompt/edit-cost-card";
import { StatusMessages } from "@/components/abraham/system-prompt/status-messages";
import { PostHeader } from "@/components/abraham/system-prompt/post-header";

export default function SystemPrompt() {
  const { fetchText, savePrompt, fetchPrice } = usePromptContract();
  const { loggedIn, login, loadingAuth, eip1193Provider } = useAuth();

  // on-chain value + local draft
  const [chainText, setChainText] = useState("");
  const [draft, setDraft] = useState("");
  const [pricePerByte, setPricePerByte] = useState<bigint>(BigInt(0));
  const [userBalance, setUserBalance] = useState<bigint>(BigInt(0));

  // ui flags
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(true);

  // Create public client for balance checking
  const publicClient = createPublicClient({
    chain: getPreferredChain(),
    transport: http(getPreferredChain().rpcUrls.default.http[0]),
  });

  // one-shot load
  useEffect(() => {
    (async () => {
      try {
        const [txt, price] = await Promise.all([fetchText(), fetchPrice()]);
        setChainText(txt);
        setDraft(txt);
        setPricePerByte(price);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
        setLoadingPrice(false);
      }
    })();
  }, []);

  // Load user balance when wallet is connected
  useEffect(() => {
    if (!eip1193Provider || !loggedIn) return;

    const loadBalance = async () => {
      try {
        const accounts = await eip1193Provider.request({
          method: "eth_accounts",
        });
        if (accounts.length > 0) {
          const balance = await publicClient.getBalance({
            address: accounts[0],
          });
          setUserBalance(balance);
        }
      } catch (error) {
        console.error("Failed to load balance:", error);
        setUserBalance(BigInt("1000000000000000000")); // 1 ETH fallback
      }
    };

    loadBalance();
  }, [eip1193Provider, loggedIn, publicClient]);

  const dirty = draft !== chainText;

  // Calculate edit cost
  const editCost = dirty
    ? (() => {
        try {
          const { changed } = buildPatch(chainText, draft);
          return pricePerByte * BigInt(changed);
        } catch {
          return BigInt(0);
        }
      })()
    : BigInt(0);

  const canAfford = userBalance >= editCost;
  const editCostEth = formatEther(editCost);
  const pricePerByteEth = formatEther(pricePerByte);
  const balanceEth = formatEther(userBalance);

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await savePrompt(chainText, draft);
      setChainText(draft);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white">
        <AppBar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin " />
            <p className="text-xs">Loading system prompt</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <AppBar />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-16 mt-2">
        <Card className="border border-gray-200 shadow-sm bg-white rounded-md overflow-hidden">
          <PostHeader dirty={dirty} editCostEth={editCostEth} />

          <CardContent className="px-6 pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Editor - Takes up 2/3 of the space */}
              <div className="lg:col-span-2 space-y-4 min-h-[500px]">
                <PromptEditor
                  draft={draft}
                  setDraft={setDraft}
                  chainText={chainText}
                  dirty={dirty}
                  saving={saving}
                  loadingAuth={loadingAuth}
                  canAfford={canAfford}
                  loggedIn={loggedIn}
                  editCostEth={editCostEth}
                  handleSave={handleSave}
                />
              </div>

              {/* Side Stats - Takes up 1/3 of the space */}
              <div className="space-y-4">
                <StatusMessages
                  dirty={dirty}
                  loggedIn={loggedIn}
                  canAfford={canAfford}
                  editCostEth={editCostEth}
                />
                <ContentStats draft={draft} chainText={chainText} />
                <DiffView chainText={chainText} draft={draft} dirty={dirty} />
                <EditCostCard
                  pricePerByteEth={pricePerByteEth}
                  loadingPrice={loadingPrice}
                  dirty={dirty}
                  chainText={chainText}
                  draft={draft}
                  editCostEth={editCostEth}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
