"use client";

import { useEffect, useState } from "react";
import AppBar from "@/components/layout/AppBar";

interface AbrahamCreation {
  _id: string;
  proposal: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function CreationsPage() {
  const [creations, setCreations] = useState<AbrahamCreation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCreations = async () => {
      try {
        const res = await fetch("/api/covenant/creations");
        if (!res.ok) throw new Error("Failed to fetch creations");
        const data = await res.json();
        setCreations(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCreations();
  }, []);

  if (loading)
    return (
      <div>
        <AppBar />
        <p className="text-center m-20">Loading creations...</p>
      </div>
    );
  if (error)
    return (
      <div>
        <AppBar />
        <p className="text-center text-red-500">{error}</p>
      </div>
    );
  if (creations.length === 0)
    return (
      <div>
        <AppBar />
        <p className="text-center m-20">No creations found.</p>
      </div>
    );

  return (
    <div>
      <AppBar />
      <div className="min-h-screen bg-gray-50 py-10">
        <h1 className="text-3xl font-bold text-center mb-8">
          Abraham Creations
        </h1>
        <div className="max-w-5xl mx-auto grid gap-6 sm:grid-cols-2 lg:grid-cols-3 px-4">
          {creations.map((creation) => (
            <div
              key={creation._id}
              className="bg-white p-6 rounded-2xl shadow hover:shadow-md transition-shadow border border-gray-100"
            >
              <h2 className="text-xl font-semibold mb-2">{creation.title}</h2>
              <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                {creation.proposal}
              </p>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span className="capitalize px-2 py-1 bg-gray-100 rounded-md">
                  {creation.status}
                </span>
                <span>{new Date(creation.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
