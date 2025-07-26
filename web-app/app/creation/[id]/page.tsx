"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2Icon, CircleXIcon } from "lucide-react";
import axios from "axios";

import AppBar from "@/components/layout/AppBar";
import CreationCard from "@/components/abraham/creations/Creation";
import Blessings from "@/components/abraham/creations/Blessings";

import { CreationItem, SubgraphMessage } from "@/types/abraham";
import { useAuth } from "@/context/auth-context";

const OWNER = process.env.NEXT_PUBLIC_OWNER_ADDRESS!.toLowerCase();

/* ─────────────────────────────────────────── types */
interface MessageGroup {
  abraham: SubgraphMessage;
  blessings: SubgraphMessage[];
}

/* ─────────────────────────────────────────── page */
export default function CreationPage({ params }: { params: { id: string } }) {
  const { loggedIn, authState } = useAuth();
  const userAddr = authState.walletAddress?.toLowerCase();
  const [creation, setCreation] = useState<CreationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* fetch creation */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get<CreationItem>(
          `/api/creations/creation?creationId=${params.id}`
        );
        setCreation(data);
        setError(null);
      } catch (e: any) {
        setError(e.message ?? "fetch error");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, loggedIn, userAddr]);

  /* group Abraham + blessings */
  const timeline: MessageGroup[] = useMemo(() => {
    if (!creation) return [];
    const groups: MessageGroup[] = [];
    let current: MessageGroup | null = null;

    creation.messages.forEach((m) => {
      if (m.author.toLowerCase() === OWNER) {
        current = { abraham: m, blessings: [] };
        groups.push(current);
      } else if (current) {
        current.blessings.push(m);
      }
    });
    return groups; // oldest first
  }, [creation]);

  /* optimistic local insert */
  const handleNewBlessing = (b: {
    userAddress: string;
    message: string;
    ethUsed: string;
    blockTimestamp?: string;
    messageUuid: string;
  }) =>
    setCreation((prev) => {
      if (!prev) return prev;
      const msgs = [...prev.messages];

      const abrahamIdx = msgs
        .map((m, i) => ({ ...m, i }))
        .reverse()
        .find((x) => x.author.toLowerCase() === OWNER)?.i;

      if (abrahamIdx === undefined) return prev;

      const nowTs =
        b.blockTimestamp ?? Math.floor(Date.now() / 1000).toString();
      const newMsg: SubgraphMessage = {
        uuid: b.messageUuid,
        author: b.userAddress,
        content: b.message,
        media: null,
        praiseCount: 0,
        timestamp: nowTs,
      };

      msgs.splice(abrahamIdx + 1, 0, newMsg);

      return {
        ...prev,
        messages: msgs,
        blessings: [
          {
            ...newMsg,
            creationId: prev.id,
            messageUuid: newMsg.uuid,
            praiseCount: 0,
          },
          ...prev.blessings,
        ],
        blessingCnt: prev.blessingCnt + 1,
      };
    });

  /* render */
  return (
    <>
      <AppBar />
      <main className="mt-12 flex flex-col items-center">
        {loading && (
          <div className="flex flex-col items-center mt-10">
            <Loader2Icon className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm mt-2">Loading creation…</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center mt-10">
            <CircleXIcon className="w-6 h-6 text-red-500" />
            <p className="text-sm mt-2">{error}</p>
          </div>
        )}

        {!loading && !error && creation && (
          <div className="flex flex-col items-center border-x">
            {timeline.map((g) => (
              <div key={g.abraham.uuid} className="w-full">
                <CreationCard
                  creation={{
                    ...creation,
                    image: g.abraham.media
                      ? g.abraham.media.replace(
                          /^ipfs:\/\//,
                          "https://ipfs.io/ipfs/"
                        )
                      : "",
                    description: g.abraham.content,
                    praiseCount: g.abraham.praiseCount,
                    messageUuid: g.abraham.uuid,
                  }}
                  onNewBlessing={handleNewBlessing}
                />

                <Blessings
                  blessings={[...g.blessings]
                    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
                    .map((b) => ({
                      author: b.author,
                      content: b.content,
                      praiseCount: b.praiseCount,
                      timestamp: b.timestamp,
                      creationId: creation.id,
                      messageUuid: b.uuid,
                    }))}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
