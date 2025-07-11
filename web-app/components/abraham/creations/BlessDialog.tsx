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
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import { useAuth } from "@/context/AuthContext";
import {
  useAbrahamContract,
  BLESS_PRICE_ETHER,
} from "@/hooks/useAbrahamContract";
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
  const { loggedIn, login, loadingAuth, userAccounts, userInfo } = useAuth();
  const { bless } = useAbrahamContract();

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  /* ------------------------------------------------ submit */
  const submit = async () => {
    if (!loggedIn) return alert("Log in first.");
    if (!text) return;

    setLoading(true);
    try {
      await bless(Number(creation.id), BLESS_PRICE_ETHER, text);

      setBlessingsCount(blessingsCount + 1);
      setLocalTotalEthUsed((e) => e + BLESS_PRICE_ETHER);

      onNewBlessing?.({
        userAddress: userAccounts ?? "",
        message: text,
        ethUsed: ethers.parseEther(BLESS_PRICE_ETHER.toString()).toString(),
        blockTimestamp: Date.now().toString(),
      });
    } catch (e) {
      console.error(e);
      alert("Failed to bless.");
    } finally {
      setLoading(false);
      setText("");
    }
  };

  /* ------------------------------------------------ UI */
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
            <Button onClick={submit} disabled={loading || !text}>
              {loading ? "Blessing…" : `Bless (0.00002 ETH)`}
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
