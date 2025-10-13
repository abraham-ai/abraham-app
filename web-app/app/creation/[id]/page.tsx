// app/creation/[id]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2Icon, CircleXIcon } from "lucide-react";
import axios from "axios";

import AppBar from "@/components/layout/AppBar";
import CreationCard from "@/components/abraham/creations/Creation";
import Blessings from "@/components/abraham/creations/Blessings";
import BlessBox from "@/components/abraham/creations/BlessBox";

import { CreationItem, SubgraphMessage } from "@/types/abraham";
import { useAuth } from "@/context/auth-context";

const OWNER = process.env.NEXT_PUBLIC_OWNER_ADDRESS!.toLowerCase();

export default function CreationPage({ params }: { params: { id: string } }) {
  const { loggedIn, authState } = useAuth();
  const userAddr = authState.walletAddress?.toLowerCase();
  const [creation, setCreation] = useState<CreationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fullFetchedRef = useRef(false);

  /* fetch lite first */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await axios.get<CreationItem>(
          `/api/experimental/creations/creation?creationId=${params.id}` // lite is default
        );
        if (!cancelled) {
          setCreation(data);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "fetch error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, loggedIn, userAddr]);

  /* background fetch FULL after first paint / idle, then merge */
  useEffect(() => {
    if (!creation || fullFetchedRef.current) return;

    let cancelled = false;
    const fetchFull = async () => {
      try {
        const res = await fetch(
          `/api/creations/creation?creationId=${params.id}&mode=full`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const full = (await res.json()) as CreationItem;
        if (cancelled) return;

        // Only merge if full actually has more messages
        setCreation((prev) => {
          if (!prev) return full;

          // Dedupe by uuid, prefer optimistic messages (prev) for identical uuid
          const map = new Map<string, SubgraphMessage>();
          for (const m of full.messages) map.set(m.uuid, m);
          for (const m of prev.messages)
            map.set(m.uuid, { ...map.get(m.uuid), ...m });

          const mergedMessages = Array.from(map.values()).sort(
            (a, b) => Number(a.timestamp) - Number(b.timestamp)
          );

          // Rebuild blessings from merged messages
          const mergedBlessings = mergedMessages
            .filter((m) => m.author.toLowerCase() !== OWNER)
            .map((m) => ({
              author: m.author,
              content: m.content,
              praiseCount: m.praiseCount,
              timestamp: m.timestamp,
              creationId: prev.id,
              messageUuid: m.uuid,
            }));

          return {
            ...full,
            messages: mergedMessages,
            blessings: mergedBlessings,
            blessingCnt: mergedBlessings.length,
          };
        });

        fullFetchedRef.current = true;
      } catch {
        // ignore background errors
      }
    };

    // schedule after paint / idle for best TTI
    if (typeof (window as any).requestIdleCallback === "function") {
      (window as any).requestIdleCallback(fetchFull, { timeout: 1500 });
    } else {
      setTimeout(fetchFull, 250);
    }

    return () => {
      cancelled = true;
    };
  }, [creation, params.id]);

  /* scroll to bottom when loaded lite/full */
  useEffect(() => {
    if (!loading && creation) {
      setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100);
    }
  }, [loading, creation]);

  /* group abraham + blessings */
  const timeline = useMemo(() => {
    if (!creation) return [];
    const groups: { abraham: SubgraphMessage; blessings: SubgraphMessage[] }[] =
      [];
    let current: (typeof groups)[number] | null = null;

    creation.messages.forEach((m) => {
      if (m.author.toLowerCase() === OWNER) {
        current = { abraham: m, blessings: [] };
        groups.push(current);
      } else if (current) {
        current.blessings.push(m);
      }
    });

    return groups;
  }, [creation]);

  /* optimistic blessing insert */
  const handleNewBlessing = (b: {
    userAddress: string;
    message: string;
    ethUsed: string;
    blockTimestamp?: string;
    messageUuid: string;
  }) =>
    setCreation((prev) => {
      if (!prev) return prev;
      if (prev.closed) return prev;

      const msgs = [...prev.messages];
      const lastAbrahamIdx = msgs
        .map((m, i) => ({ ...m, i }))
        .reverse()
        .find((x) => x.author.toLowerCase() === OWNER)?.i;

      if (lastAbrahamIdx === undefined) return prev;

      const ts = b.blockTimestamp ?? Math.floor(Date.now() / 1000).toString();
      const newMsg: SubgraphMessage = {
        uuid: b.messageUuid,
        author: b.userAddress,
        content: b.message,
        media: null,
        praiseCount: 0,
        timestamp: ts,
      };

      // Dedup if already merged by full
      if (msgs.some((m) => m.uuid === newMsg.uuid)) return prev;

      msgs.splice(lastAbrahamIdx + 1, 0, newMsg);

      return {
        ...prev,
        messages: msgs,
        blessings: [
          {
            ...newMsg,
            creationId: prev.id,
            messageUuid: newMsg.uuid,
          },
          ...prev.blessings,
        ],
        blessingCnt: prev.blessingCnt + 1,
      };
    });

  return (
    <>
      <AppBar />
      <main className="mt-12 mb-12 flex flex-col items-center">
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
                          "https://gateway.pinata.cloud/ipfs/"
                        )
                      : "",
                    description: g.abraham.content,
                    praiseCount: g.abraham.praiseCount,
                    messageUuid: g.abraham.uuid,
                    timestamp: g.abraham.timestamp,
                  }}
                />
                <Blessings
                  blessings={[...g.blessings]
                    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
                    .map((b) => ({
                      author: b.author,
                      content: b.content,
                      praiseCount: b.praiseCount,
                      timestamp: b.timestamp,
                      creationId: creation.id,
                      messageUuid: b.uuid,
                    }))}
                  closed={creation.closed}
                  parentSessionIdRaw={creation.sessionIdRaw}
                />
              </div>
            ))}

            {!creation.closed && (
              <BlessBox creation={creation} onNewBlessing={handleNewBlessing} />
            )}

            {creation.closed && (
              <div className="w-full max-w-2xl px-4 py-6 text-center">
                <p className="text-gray-500 italic">
                  Abraham has closed this creation
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
