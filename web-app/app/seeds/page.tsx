"use client";

import { useEffect, useState } from "react";
import AppBar from "@/components/layout/AppBar";
import MinimalGallery, {
  type GalleryItem,
} from "@/components/Gallery/MinimalGallery";

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

export default function CreationsPage() {
  const [creations, setCreations] = useState<AbrahamCreation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchCreations = async () => {
      try {
        const res = await fetch(
          `/api/covenant/creations?page=${page}&limit=20`
        );
        if (!res.ok) throw new Error("Failed to fetch creations");
        const data = await res.json();
        console.log("Fetched creations:", data);
        setCreations(data.creations);
        setTotalPages(data.pagination.totalPages);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching creations:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchCreations();
  }, [page]);

  // Map AbrahamCreation data to GalleryItem format - only include items with images
  const galleryItems: GalleryItem[] = creations
    .filter((creation) => {
      console.log("Checking creation:", creation._id, "image:", creation.image);
      return creation.image; // Only include creations with images
    })
    .map((creation) => ({
      id: creation._id,
      title: creation.title,
      tagline: creation.tagline || creation.proposal.substring(0, 60) + "...",
      image: creation.image!,
      alt: creation.title,
      session_id: creation.session_id,
      cast_hash: creation.cast_hash,
      createdAt: creation.createdAt,
      blessingsCount: (creation as any).blessingsCount ?? 0,
    }));

  if (loading)
    return (
      <div className="min-h-screen bg-white">
        <AppBar />
        <p className="text-center m-20 text-gray-900">Loading seeds...</p>
      </div>
    );
  if (error)
    return (
      <div className="min-h-screen bg-white">
        <AppBar />
        <p className="text-center text-red-500 m-20">{error}</p>
      </div>
    );
  if (galleryItems.length === 0)
    return (
      <div className="min-h-screen bg-white">
        <AppBar />
        <p className="text-center m-20 text-gray-900">No seeds found.</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <AppBar />
      <section className="w-full py-10 sm:py-12 lg:py-16">
        <div className="mb-8 px-4 text-center">
          <p className="text-xl text-gray-700" style={{ fontFamily: 'Garamond, serif' }}>Visit any Seed to command Abraham</p>
        </div>
        <MinimalGallery
          items={galleryItems}
          persistBlessings={false}
          storageKey="abraham_creations_bless"
          aspectRatio="6 / 4"
          showBlessings={false}
          linkToFarcaster={true}
        />
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8 px-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
