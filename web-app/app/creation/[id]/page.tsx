"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2Icon, CircleXIcon } from "lucide-react";
import axios from "axios";

import AppBar from "@/components/layout/AppBar";
import CreationCard from "@/components/abraham/creations/Creation";
import Blessings from "@/components/abraham/creations/Blessings";

import { CreationItem, SubgraphMessage } from "@/types/abraham";
import { useAuth } from "@/context/auth-context";

const OWNER = process.env.NEXT_PUBLIC_OWNER_ADDRESS!.toLowerCase();

/* ───────────────────────────────────────────── types */
interface MessageGroup {
  abraham: SubgraphMessage;
  blessings: SubgraphMessage[];
}

/* ───────────────────────────────────────────── page */
export default function CreationPage({ params }: { params: { id: string } }) {
  const { loggedIn, authState } = useAuth();
  const { walletAddress } = authState;
  const userAddress = walletAddress?.toLowerCase();
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
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(e);
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, loggedIn, userAddress]);

  /* build timeline */
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

    return groups.reverse(); // newest Abraham first
  }, [creation]);

  /* optimistic live bless insert */
  const handleNewBlessing = (b: {
    userAddress: string;
    message: string;
    ethUsed: string;
    blockTimestamp?: string;
  }) =>
    setCreation((prev) => {
      if (!prev) return prev;

      const messages = [...prev.messages];
      const latestAbrahamIndex = messages
        .map((m, i) => ({ ...m, i }))
        .reverse()
        .find((m) => m.author.toLowerCase() === OWNER)?.i;

      if (latestAbrahamIndex === undefined) return prev;

      const newBlessingMsg = {
        author: b.userAddress,
        content: b.message,
        praiseCount: 0,
        timestamp: b.blockTimestamp ?? Math.floor(Date.now() / 1000).toString(),
        index: Date.now(), // Ensure uniqueness
        media: "",
      };

      // Insert directly after the Abraham post
      messages.splice(latestAbrahamIndex + 1, 0, newBlessingMsg);
      //console.log("New blessing added:", newBlessingMsg);
      return {
        ...prev,
        messages,
        blessings: [newBlessingMsg, ...prev.blessings],
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
            {timeline.map((group) => (
              <div key={group.abraham.index} className="w-full">
                {/* Abraham post */}
                <CreationCard
                  creation={{
                    ...creation,
                    image: group.abraham.media
                      ? group.abraham.media.replace(
                          /^ipfs:\/\//,
                          "https://ipfs.io/ipfs/"
                        )
                      : "",
                    description: group.abraham.content,
                    praiseCount: group.abraham.praiseCount,
                    messageIndex: group.abraham.index,
                  }}
                  onNewBlessing={handleNewBlessing}
                />

                {/* Blessings for that post */}
                <Blessings
                  blessings={[...group.blessings].sort(
                    (a, b) =>
                      parseInt(b.timestamp ?? "0", 10) -
                      parseInt(a.timestamp ?? "0", 10)
                  )}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
