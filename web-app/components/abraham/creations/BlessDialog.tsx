"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import {
  useAbrahamContract,
  BLESS_PRICE_ETHER,
} from "@/hooks/use-abraham-contract";
import { CreationItem } from "@/types/abraham";
import { ethers } from "ethers";

interface Props {
  creation: CreationItem;
  blessingsCount: number;
  setBlessingsCount: (n: number) => void;
  setLocalTotalEthUsed: React.Dispatch<React.SetStateAction<number>>;
  onNewBlessing?: (b: {
    userAddress: string;
    message: string;
    ethUsed: string;
    blockTimestamp?: string;
  }) => void;
}

export default function BlessDialog({
  creation,
  blessingsCount,
  setBlessingsCount,
  setLocalTotalEthUsed,
  onNewBlessing,
}: Props) {
  const { loggedIn, login, loadingAuth, authState } = useAuth();
  const { bless } = useAbrahamContract();
  const { walletAddress } = authState;

  const userAddress = walletAddress?.toLowerCase();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  /* ---------------- submit ---------------- */
  const submit = async () => {
    if (!loggedIn) return alert("Please log in first.");
    if (!text.trim()) return;

    setLoading(true);
    try {
      await bless(Number(creation.id), text.trim());

      // optimistic UI updates
      setBlessingsCount(blessingsCount + 1);
      setLocalTotalEthUsed((e) => e + BLESS_PRICE_ETHER);

      onNewBlessing?.({
        userAddress: userAddress || "",
        message: text.trim(),
        ethUsed: ethers.parseEther(BLESS_PRICE_ETHER.toString()).toString(),
        blockTimestamp: Math.floor(Date.now() / 1000).toString(),
      });
    } catch (e) {
      console.error(e);
      alert("Failed to bless.");
    } finally {
      setLoading(false);
      setText("");
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <Dialog>
      <DialogTrigger asChild>
        <p className="cursor-pointer">🙏</p>
      </DialogTrigger>

      <DialogContent className="bg-white">
        {/* header */}
        <div className="flex items-center mb-4">
          <Image
            src="/abrahamlogo.png"
            alt="abraham"
            width={40}
            height={40}
            className="rounded-full border mr-3"
          />
          <span className="font-semibold">Bless Creation</span>
        </div>

        {/* textarea */}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share a blessing or kind thought…"
        />

        {/* footer */}
        <DialogFooter>
          {loggedIn ? (
            <Button onClick={submit} disabled={loading || !text.trim()}>
              {loading ? "Blessing…" : `Bless (${BLESS_PRICE_ETHER} ETH)`}
            </Button>
          ) : (
            <Button onClick={login} disabled={loadingAuth}>
              {loadingAuth ? "Logging in…" : "Log in"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
