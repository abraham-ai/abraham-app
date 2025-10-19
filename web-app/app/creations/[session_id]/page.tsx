"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppBar from "@/components/layout/AppBar";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface AbrahamCreation {
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
}

function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export default function CreationDetailPage() {
  const params = useParams();
  const session_id = params.session_id as string;
  const [creation, setCreation] = useState<AbrahamCreation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreation = async () => {
      try {
        // Check if session_id is a number (index) or a session ID
        const isNumeric = /^\d+$/.test(session_id);
        let res;

        if (isNumeric) {
          // Fetch by index
          res = await fetch(`/api/creations/by-index/${session_id}`);
        } else {
          // Fetch by session_id
          res = await fetch(`/api/seeds/${session_id}`);
        }

        if (!res.ok) throw new Error("Failed to fetch creation");
        const data = await res.json();
        setCreation(data);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching creation:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (session_id) {
      fetchCreation();
    }
  }, [session_id]);

  if (loading)
    return (
      <div className="min-h-screen bg-white">
        <AppBar />
        <p className="text-center m-20 text-gray-900">Loading...</p>
      </div>
    );

  if (error || !creation)
    return (
      <div className="min-h-screen bg-white">
        <AppBar />
        <p className="text-center text-red-500 m-20">{error || "Creation not found"}</p>
      </div>
    );

  const posterImage = creation.creation?.poster_image;
  const title = creation.creation?.title || creation.title;
  const tagline = creation.creation?.tagline || creation.tagline;
  const blogPost = creation.creation?.blog_post;
  const txHash = creation.creation?.tx_hash;
  const explorerUrl = creation.creation?.explorer_url;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <AppBar />
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-10">
        {posterImage && (
          <div className="relative w-full mb-6" style={{ aspectRatio: "6 / 4" }}>
            <Image
              src={posterImage}
              alt={title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        <h1 className="text-4xl font-bold mb-3">{title}</h1>
        {tagline && <p className="text-xl text-gray-600 mb-6">{tagline}</p>}

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 pb-6 border-b">
          <span>Created {new Date(creation.createdAt).toLocaleDateString()}</span>
          {creation.cast_hash && (
            <a
              href={`https://farcaster.xyz/abraham-ai/${creation.cast_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-gray-900"
            >
              <svg width="16" height="16" viewBox="0 0 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="1000" height="1000" rx="200" fill="#8A63D2"/>
                <path d="M257.778 155.556H742.222V844.445H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.445H257.778V155.556Z" fill="white"/>
                <path d="M128.889 253.333L128.889 155.556H100L100 253.333L128.889 253.333Z" fill="white"/>
                <path d="M900 253.333L900 155.556H871.111L871.111 253.333L900 253.333Z" fill="white"/>
              </svg>
              View on Farcaster
            </a>
          )}
          {txHash && explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-gray-900 font-mono"
              title={txHash}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {truncateAddress(txHash)}
            </a>
          )}
        </div>

        {blogPost && (
          <article className="prose prose-lg max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                img: ({node, ...props}) => (
                  <img {...props} className="rounded-lg my-6" loading="lazy" />
                ),
                a: ({node, ...props}) => (
                  <a {...props} className="text-blue-600 hover:text-blue-800" target="_blank" rel="noopener noreferrer" />
                ),
                h1: ({node, ...props}) => (
                  <h1 {...props} className="text-3xl font-bold mt-8 mb-4" />
                ),
                h2: ({node, ...props}) => (
                  <h2 {...props} className="text-2xl font-bold mt-6 mb-3" />
                ),
                h3: ({node, ...props}) => (
                  <h3 {...props} className="text-xl font-bold mt-4 mb-2" />
                ),
                p: ({node, ...props}) => (
                  <p {...props} className="mb-4 leading-relaxed" />
                ),
                ul: ({node, ...props}) => (
                  <ul {...props} className="list-disc pl-6 mb-4" />
                ),
                ol: ({node, ...props}) => (
                  <ol {...props} className="list-decimal pl-6 mb-4" />
                ),
                blockquote: ({node, ...props}) => (
                  <blockquote {...props} className="border-l-4 border-gray-300 pl-4 italic my-4" />
                ),
                code: ({node, inline, ...props}: any) =>
                  inline ? (
                    <code {...props} className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" />
                  ) : (
                    <code {...props} className="block bg-gray-100 p-4 rounded my-4 overflow-x-auto font-mono text-sm" />
                  ),
              }}
            >
              {blogPost}
            </ReactMarkdown>
          </article>
        )}
      </div>
    </div>
  );
}
