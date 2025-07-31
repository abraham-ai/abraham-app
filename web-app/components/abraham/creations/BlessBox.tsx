"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import {
  useAbrahamContract,
  BLESS_PRICE_ETHER,
} from "@/hooks/use-abraham-contract";
import { CreationItem } from "@/types/abraham";
import { Loader2Icon } from "lucide-react";
import { showErrorToast, showWarningToast } from "@/lib/error-utils";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";

interface Props {
  creation: CreationItem;
  onNewBlessing?: (b: {
    userAddress: string;
    message: string;
    ethUsed: string;
    blockTimestamp?: string;
    messageUuid: string;
  }) => void;
}

export default function BlessBox({ creation, onNewBlessing }: Props) {
  const { loggedIn, login, loadingAuth, authState } = useAuth();
  const { bless } = useAbrahamContract();
  const userAddress = authState.walletAddress?.toLowerCase() ?? "";
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!loggedIn) {
      showWarningToast("Authentication", "Please connect your wallet.");
      return;
    }
    if (!text.trim()) {
      showWarningToast("Message Required", "Enter a blessing.");
      return;
    }

    setLoading(true);
    try {
      const { msgUuid } = await bless(creation.id, text.trim());

      onNewBlessing?.({
        userAddress,
        message: text.trim(),
        ethUsed: (BLESS_PRICE_ETHER * 10 ** 18).toString(),
        blockTimestamp: Math.floor(Date.now() / 1000).toString(),
        messageUuid: msgUuid,
      });

      setText("");
    } catch (e) {
      /* toast handled in hook */
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => login().catch((e) => showErrorToast(e, "Login"));

  return (
    <div className="border-t p-4 lg:w-[43vw] w-full">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {userAddress ? (
            <RandomPixelAvatar username={userAddress} size={40} />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200" />
          )}
        </div>
        <div className="flex-grow">
          {loggedIn ? (
            <>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="How should Abraham proceed?"
                className="min-h-[120px] resize-none"
                maxLength={320}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-500">
                  {text.length > 300 && `${text.length}/320 characters`}
                </span>
                <Button 
                  onClick={submit} 
                  disabled={loading || !text.trim()}
                  size="sm"
                >
                  {loading && (
                    <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                  )}
                  {loading ? "Blessing…" : `Bless for ${BLESS_PRICE_ETHER} ETH`}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-4 bg-gray-50 rounded-lg">
              <p className="text-gray-600 mb-3">Connect your wallet to bless this creation</p>
              <Button onClick={handleLogin} disabled={loadingAuth}>
                {loadingAuth ? (
                  <>
                    <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                    Connecting…
                  </>
                ) : (
                  "Connect Wallet"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}