"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2Icon, CircleXIcon } from "lucide-react";
import axios from "axios";

import AppBar from "@/components/layout/AppBar";
import Creation from "@/components/abraham/creations/Creation";
import Blessings from "@/components/abraham/creations/Blessings";

import { CreationItem } from "@/types/abraham";
import { useAuth } from "@/context/AuthContext";

export default function CreationPage({ params }: { params: { id: string } }) {
  /* ─────────────────────────────── state */
  const { loggedIn, userAccounts } = useAuth();

  const [creation, setCreation] = useState<CreationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ─────────────────────────────── fetch */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get<CreationItem>(
          `/api/creations/${params.id}`
        );
        setCreation(data);
        setError(null);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? "Failed to load creation.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id, loggedIn, userAccounts]);

  /* ────────────────────────── live bless insert */
  const handleNewBlessing = (b: {
    userAddress: string;
    message: string;
    ethUsed: string;
    blockTimestamp?: string;
  }) =>
    setCreation((prev) =>
      prev
        ? {
            ...prev,
            blessings: [
              {
                author: b.userAddress,
                content: b.message,
                praiseCount: 0,
                timestamp: b.blockTimestamp ?? "",
              },
              ...prev.blessings,
            ],
            blessingCnt: prev.blessingCnt + 1,
          }
        : prev
    );

  /* ─────────────────────────────── render */
  return (
    <>
      <AppBar />

      <main className="mt-12 flex flex-col items-center">
        {/* spinners & errors */}
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

        {/* actual page */}
        {!loading && !error && creation && (
          <div className="flex flex-col items-center border-x">
            {/* main card */}
            <Creation creation={creation} onNewBlessing={handleNewBlessing} />

            {/* optional variations / placeholders */}
            <div className="flex items-center justify-center mt-6">
              {[1, 2, 3, 4].map((i) => (
                <Image
                  key={i}
                  src="https://github.com/shadcn.png"
                  alt="variation"
                  width={120}
                  height={140}
                  className="m-1 rounded-lg"
                />
              ))}
            </div>

            {/* blessings list */}
            <Blessings
              blessings={[...creation.blessings].sort(
                (a, b) =>
                  parseInt(b.timestamp ?? "0", 10) -
                  parseInt(a.timestamp ?? "0", 10)
              )}
            />
          </div>
        )}
      </main>
    </>
  );
}
