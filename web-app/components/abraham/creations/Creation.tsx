"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { CreationItem } from "@/types/abraham";
import { useAuth } from "@/context/auth-context";
import {
  useAbrahamContract,
  PRAISE_PRICE_ETHER,
} from "@/hooks/use-abraham-contract";
import BlessDialog from "./BlessDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { showErrorToast, showWarningToast } from "@/lib/error-utils";

export default function Creation({
  creation,
  onNewBlessing,
}: {
  creation: CreationItem;
  onNewBlessing?: (...args: any[]) => void;
}) {
  const { loggedIn, login, loadingAuth } = useAuth();
  const { praise } = useAbrahamContract();
  const [totEth, setTotEth] = useState(creation.ethTotal);
  const [praises, setPraises] = useState(creation.praiseCount);
  const [blessingsCnt, setBlessingsCnt] = useState(creation.blessingCnt);
  const [loadingPraise, setLoadingPraise] = useState(false);

  const handlePraise = async () => {
    if (!loggedIn) {
      showWarningToast("Authentication Required", "Please log in.");
      return;
    }
    setLoadingPraise(true);
    try {
      await praise(creation.id, creation.messageUuid);
      setPraises((p) => p + 1);
      setTotEth((e) => e + PRAISE_PRICE_ETHER);
    } finally {
      setLoadingPraise(false);
    }
  };

  /* timestamps */
  const createdAt = new Date(
    Number(creation.firstMessageAt) * 1000
  ).toLocaleDateString();
  const updatedAt = new Date(
    Number(creation.lastActivityAt) * 1000
  ).toLocaleString();

  return (
    <div className="grid grid-cols-12 border-b p-4 lg:w-[43vw] w-full">
      <Link href={`/creation/${creation.id}`} className="col-span-1 mr-3">
        <Image
          src="/abrahamlogo.png"
          alt="avatar"
          width={100}
          height={100}
          className="rounded-full border aspect-square"
        />
      </Link>

      <div className="col-span-11 flex flex-col">
        <Link href={`/creation/${creation.id}`} className="flex flex-col pr-8">
          <p className="mb-1">{creation.description}</p>
          <Image
            src={creation.image || "/placeholder.svg"}
            alt="creation"
            width={500}
            height={300}
            className="w-full rounded-lg aspect-[5/4] object-cover mt-2 border"
            onError={() => showErrorToast(new Error("image"), "Image Error")}
          />
        </Link>

        <div className="text-xs text-gray-400 mt-2">
          Created {createdAt} • Last {updatedAt}
        </div>

        {/* actions */}
        <div className="flex items-center mt-4 mb-2">
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="text-gray-500 hover:text-blue-500"
                disabled={loadingPraise}
              >
                🙌
              </button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Praise Creation</DialogTitle>
                <DialogDescription>
                  {PRAISE_PRICE_ETHER.toFixed(5)} ETH will be sent
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={handlePraise} disabled={loadingPraise}>
                  {loadingPraise && (
                    <Loader2Icon className="w-4 h-4 animate-spin mr-1" />
                  )}
                  {loadingPraise ? "Praising…" : "Praise"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <span className="ml-1 text-sm font-semibold">{praises}</span>

          {/* bless */}
          <div className="ml-10">
            <BlessDialog
              creation={creation}
              blessingsCount={blessingsCnt}
              setBlessingsCount={setBlessingsCnt}
              setLocalTotalEthUsed={setTotEth}
              onNewBlessing={onNewBlessing}
            />
          </div>
          <span className="ml-1 text-sm font-semibold">{blessingsCnt}</span>
        </div>
      </div>
    </div>
  );
}
