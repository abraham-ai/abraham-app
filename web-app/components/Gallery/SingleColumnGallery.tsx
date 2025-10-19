"use client";
import React from "react";
import Link from "next/link";
import NextImage from "next/image";

export type SingleColumnGalleryItem = {
  id: string;
  title: string;
  tagline: string;
  image: string;
  alt?: string;
  session_id?: string;
  createdAt?: string;
};

export type SingleColumnGalleryProps = {
  items: SingleColumnGalleryItem[];
  className?: string;
  useNextImage?: boolean;
  basePath?: string;
};

// Calculate day number (Day 1 is oldest, increasing for newer items)
function getDayNumber(dateString: string, allDates: string[]): number {
  // Sort all dates in ascending order (oldest first)
  const sortedDates = [...allDates].sort((a, b) =>
    new Date(a).getTime() - new Date(b).getTime()
  );

  // Find the index of this date and add 1 (to start from Day 1)
  const index = sortedDates.indexOf(dateString);
  return index + 1;
}

// Format date as "Month Day, Year"
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

export default function SingleColumnGallery({
  items,
  className = "",
  useNextImage = true,
  basePath = "/creations2",
}: SingleColumnGalleryProps) {
  // Get all dates for calculating day numbers
  const allDates = items.map((item) => item.createdAt).filter(Boolean) as string[];

  return (
    <section className={`w-full ${className}`}>
      <div className="max-w-4xl mx-auto px-4 space-y-12">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`${basePath}/${item.session_id}`}
            className="block"
          >
            <article className="overflow-hidden border border-gray-200 bg-white hover:border-gray-400 transition-colors">
              <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
                {useNextImage ? (
                  <NextImage
                    src={item.image}
                    alt={item.alt ?? item.title}
                    fill
                    sizes="(max-width: 896px) 100vw, 896px"
                    className="object-cover"
                    priority={false}
                  />
                ) : (
                  <img
                    src={item.image}
                    alt={item.alt ?? item.title}
                    loading="lazy"
                    className="h-full w-full object-cover absolute inset-0"
                  />
                )}
              </div>
              <div className="p-6">
                <h2 className="text-3xl font-bold text-gray-900 leading-tight mb-2" style={{ fontFamily: 'Garamond, serif' }}>
                  {item.title}
                </h2>
                <p className="text-lg text-gray-500 mb-4" style={{ fontFamily: 'Garamond, serif' }}>
                  {item.tagline}
                </p>
                {item.createdAt && (
                  <div className="flex items-center gap-2 text-sm text-gray-400" style={{ fontFamily: 'Garamond, serif' }}>
                    <span>Day {getDayNumber(item.createdAt, allDates)}</span>
                    <span>·</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                )}
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
