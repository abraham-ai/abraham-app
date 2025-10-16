import type { Metadata } from "next";
import { headers } from "next/headers";
import React from "react";
import { normalizeImageUrl } from "@/lib/socialembeds";

type AbrahamSeed = {
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
};

function getOrigin(): string | null {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto =
    h.get("x-forwarded-proto") ||
    (host?.includes("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : null;
}

function truncate(text: string, max = 200): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// normalizeImageUrl moved to @/lib/og

export async function generateMetadata({
  params,
}: {
  params: { session_id: string };
}): Promise<Metadata> {
  const origin = getOrigin();
  const base = origin ? new URL(origin) : undefined;
  const apiUrl = origin
    ? `${origin}/api/seeds/${params.session_id}`
    : undefined;

  let seed: AbrahamSeed | null = null;
  if (apiUrl) {
    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (res.ok) seed = (await res.json()) as AbrahamSeed;
    } catch {
      // ignore and fall back to defaults
    }
  }

  const title = seed?.title || "Seed | Abraham";
  const description =
    seed?.tagline ||
    truncate(seed?.proposal || "An Autonomous Artificial Artist", 200);
  const normalized = normalizeImageUrl(seed?.image, origin);
  const imageUrl =
    normalized || (origin ? `${origin}/abrahamlogo.png` : "/abrahamlogo.png");
  const pageUrl = origin ? `${origin}/seeds/${params.session_id}` : undefined;

  return {
    metadataBase: base,
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: pageUrl,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function SeedRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
