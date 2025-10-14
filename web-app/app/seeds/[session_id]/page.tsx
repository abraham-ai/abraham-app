"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppBar from "@/components/layout/AppBar";
import Image from "next/image";

interface AbrahamSeed {
  _id: string;
  proposal: string;
  title: string;
  status: string;
  image?: string;
  tagline?: string;
  session_id: string;
  cast_hash?: string;
  createdAt: string;
  updatedAt: string;
}

export default function SeedDetailPage() {
  const params = useParams();
  const session_id = params.session_id as string;
  const [seed, setSeed] = useState<AbrahamSeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSeed = async () => {
      try {
        const res = await fetch(`/api/seeds/${session_id}`);
        if (!res.ok) throw new Error("Failed to fetch seed");
        const data = await res.json();
        setSeed(data);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching seed:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (session_id) {
      fetchSeed();
    }
  }, [session_id]);

  if (loading)
    return (
      <div className="min-h-screen bg-white">
        <AppBar />
        <p className="text-center m-20 text-gray-900">Loading...</p>
      </div>
    );

  if (error || !seed)
    return (
      <div className="min-h-screen bg-white">
        <AppBar />
        <p className="text-center text-red-500 m-20">{error || "Seed not found"}</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <AppBar />
      <div className="max-w-4xl mx-auto px-4 py-10">
        {seed.image && (
          <div className="relative w-full mb-6" style={{ aspectRatio: "6 / 4" }}>
            <Image
              src={seed.image}
              alt={seed.title}
              fill
              className="object-cover rounded-2xl"
              priority
            />
          </div>
        )}
        <h1 className="text-3xl font-bold mb-2">{seed.title}</h1>
        {seed.tagline && <p className="text-xl text-gray-600 mb-4">{seed.tagline}</p>}
        <p className="text-gray-700 mb-6">{seed.proposal}</p>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Created {new Date(seed.createdAt).toLocaleDateString()}</span>
          {seed.cast_hash && (
            <a
              href={`https://farcaster.xyz/abraham-ai/${seed.cast_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-gray-900"
            >
              <svg width="16" height="16" viewBox="0 0 1000 1000" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z"/>
                <path d="M128.889 253.333L128.889 155.556H100L100 253.333L128.889 253.333Z"/>
                <path d="M900 253.333L900 155.556H871.111L871.111 253.333L900 253.333Z"/>
              </svg>
              View on Farcaster
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
