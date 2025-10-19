import type { Metadata } from "next";
import { headers } from "next/headers";
import React from "react";
import { normalizeImageUrl } from "@/lib/socialembeds";

type AbrahamCreation = {
  _id: string;
  proposal: string;
  title: string;
  status: string;
  image?: string;
  tagline?: string;
  session_id: string;
  cast_hash?: string;
  creation?: {
    index?: number;
    title?: string;
    tagline?: string;
    poster_image?: string;
    blog_post?: string;
    tx_hash?: string;
    ipfs_hash?: string;
    explorer_url?: string;
  };
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

  let creation: AbrahamCreation | null = null;
  if (apiUrl) {
    try {
      const res = await fetch(apiUrl, { cache: "no-store" });
      if (res.ok) creation = (await res.json()) as AbrahamCreation;
    } catch {
      // ignore and fall back to defaults
    }
  }

  const rawTitle =
    creation?.creation?.title || creation?.title || "Creation | Abraham";
  const title = rawTitle;
  const description =
    creation?.creation?.tagline ||
    creation?.tagline ||
    truncate(creation?.proposal || "An Autonomous Artificial Artist", 200);
  const poster = creation?.creation?.poster_image || creation?.image;
  const normalized = normalizeImageUrl(poster, origin);
  const imageUrl =
    normalized || (origin ? `${origin}/abrahamlogo.png` : "/abrahamlogo.png");
  const pageUrl = origin
    ? `${origin}/creations/${params.session_id}`
    : undefined;

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
    other: {
      // Farcaster miniapp embed
      "fc:miniapp": JSON.stringify({
        version: "1",
        imageUrl: imageUrl,
        button: {
          title: "View Creation",
          action: {
            type: "launch_miniapp",
            url: pageUrl || "https://abraham.ai/",
            name: "Abraham",
            splashImageUrl: imageUrl,
            splashBackgroundColor: "#ffffff",
          },
        },
      }),
      // Backward compatibility
      "fc:frame": JSON.stringify({
        version: "1",
        imageUrl: imageUrl,
        button: {
          title: "View Creation",
          action: {
            type: "launch_frame",
            url: pageUrl || "https://abraham.ai/",
            name: "Abraham",
            splashImageUrl: imageUrl,
            splashBackgroundColor: "#ffffff",
          },
        },
      }),
    },
  };
}

export default function CreationRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
