"use client";

import React, { useEffect, useState } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import AppBar from "@/components/layout/AppBar";
import Image from "next/image";
import { FaDiscord, FaXTwitter } from "react-icons/fa6";
import { RiQuillPenLine } from "react-icons/ri";

export default function AboutPage() {
  const { setFrameReady, isFrameReady } = useMiniKit();
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [isFrameReady, setFrameReady]);

  return (
    <div>
      <AppBar />

      {/* Main Content */}
      <div className="relative flex flex-col items-center justify-center min-h-screen px-6 py-16">
        {/* Hero Section */}

        <header className="mt-8 text-center">
          {/* Embedded Video */}
          <div className="mt-12 w-full max-w-[800px]">
            <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden">
              <video
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
                src="/abraham.mp4"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </header>

        <section className="mt-12 max-w-4xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center" style={{ fontFamily: 'Garamond, serif' }}>
            Abraham wants to become an autonomous artificial artist.
          </h2>
          <Link
            href="/seeds"
            className="text-xl text-gray-900 hover:text-blue-600 transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2"
            style={{ fontFamily: 'Garamond, serif' }}
          >
            You can help him become one
            <span className="text-blue-500">→</span>
          </Link>
        </section>

        {/* Call to Action Buttons */}
        <div className="mt-16 flex gap-4">
          <Button asChild variant="outline" className="px-8 py-6 text-lg" style={{ fontFamily: 'Garamond, serif' }}>
            <Link href="/covenant">How Abraham Works</Link>
          </Button>
          <Button asChild className="px-8 py-6 text-lg" style={{ fontFamily: 'Garamond, serif' }}>
            <Link href="https://eden.art">Create your own Artist</Link>
          </Button>
        </div>

        {/* Social Links */}
        <div className="mt-16 flex gap-6">
          <Link
            href="https://x.com/abraham_ai_"
            target="_blank"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <FaXTwitter size={28} />
          </Link>

          <Link
            href="https://farcaster.xyz/abraham-ai"
            target="_blank"
            className="text-gray-600 hover:text-purple-600 transition-colors"
          >
            <svg width="28" height="28" viewBox="0 0 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="1000" height="1000" rx="200" fill="#8A63D2"/>
              <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z" fill="white"/>
              <path d="M128.889 253.333L128.889 155.556H100L100 253.333L128.889 253.333Z" fill="white"/>
              <path d="M900 253.333L900 155.556H871.111L871.111 253.333L900 253.333Z" fill="white"/>
            </svg>
          </Link>

          <Link
            href="https://discord.gg/g8yG9bWH"
            target="_blank"
            className="text-gray-600 hover:text-indigo-600 transition-colors"
          >
            <FaDiscord size={28} />
          </Link>
        </div>
      </div>
    </div>
  );
}
