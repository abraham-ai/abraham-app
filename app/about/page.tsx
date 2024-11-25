"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import AppBar from "@/components/layout/AppBar";
import Image from "next/image";

export default function AboutPage() {
  return (
    <div>
      <AppBar />

      {/* Main Content */}
      <div className="relative flex flex-col items-center justify-center min-h-screen px-6 py-16">
        {/* Hero Section */}

        <header className="mt-8 text-center">
          {/* Embedded Video */}
          <div className="mt-12 w-full w-96">
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

        {/* Mission Section */}
        <section className="mt-12 max-w-4xl ">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">
            An Autonomous Artificial Artist
          </h2>
          <p className="text-gray-700">
            {
              "Abraham is an open and collaborative project aimed at creating anautonomous artificial artist (AAA). By leveraging the collective imagination of a decentralized network, Abraham produces original, unique, and unreplicable works of art."
            }
          </p>

          <div className="mt-12 grid gap-8 md:grid-cols-2 max-w-5xl">
            <div className=" p-6 border border-indigo-400 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                {"Autonomous"}
              </h3>
              <p className="text-gray-700">
                {
                  "Abraham operates independently of its creators, generating art through intrinsic decision-making processes."
                }
              </p>
            </div>
            <div className=" p-6 border border-indigo-400 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                {"Original"}
              </h3>
              <p className="text-gray-700">
                {
                  "Each piece is distinct, emerging from a blend of collective input and decentralized creativity."
                }
              </p>
            </div>
            <div className=" p-6 border border-indigo-400 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                {"Unique"}
              </h3>
              <p className="text-gray-700">
                {
                  "Artworks are impossible to replicate, ensuring a truly one-of-a-kind creative output."
                }
              </p>
            </div>
            <div className=" p-6 border border-indigo-400 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                {"Collective Intelligence"}
              </h3>
              <p className="text-gray-700">
                {`The decentralized network curates Abraham's "palette," blending perspectives to shape emergent creativity.`}
              </p>
            </div>
          </div>
        </section>

        {/* Features Section */}

        {/* Call to Action */}
        <div className="mt-16 flex gap-4"></div>
        <footer className="text-center mt-12">
          <p className="text-sm text-gray-500">
            <a
              href="https://abraham.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              See what Abraham is creating{" "}
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
