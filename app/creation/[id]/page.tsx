"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Creation from "@/components/abraham/creations/Creation";
import AppBar from "@/components/layout/AppBar";
import { CreationItem } from "@/types";
import Blessings from "@/components/abraham/creations/Blessings";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import Image from "next/image";

export default function CreationPage({ params }: { params: { id: string } }) {
  const [creation, setCreation] = useState<CreationItem | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Fetch all creations and find the one with the matching ID
    axios.get("/api/artlabproxy/stories").then((res) => {
      const filteredCreation: CreationItem | null =
        res.data.find((item: CreationItem) => {
          return item._id === params.id;
        }) || null;

      setCreation(filteredCreation);
      console.log("Creation:", filteredCreation);
    });
  }, []);

  // Function to handle clicking on a thumbnail
  const handleThumbnailClick = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <>
      <div>
        <AppBar />
        <div className="mt-12 flex flex-col items-center justify-center w-full">
          <div className="flex flex-col items-center justify-center">
            <div className="flex flex-col items-center justify-center border-x">
              <div>{creation && <Creation creation={creation} />}</div>
              {/* Stills */}
              {creation?.stills && creation.stills.length > 0 && (
                <div className="grid grid-cols-12 border-b p-4 lg:w-[43vw]">
                  <div className="col-span-1 flex flex-col mr-3">
                    <Image
                      src={"/abrahamlogo.png"}
                      alt={"Abraham"}
                      width={100}
                      height={100}
                      className="rounded-full aspect-[1] object-cover border"
                    />
                  </div>
                  <div className="col-span-11 flex flex-col pr-4">
                    <div className="grid grid-cols-12 ">
                      <div className="col-span-9 flex flex-col mr-0.5 mt-2">
                        {/* Simple Carousel */}
                        <div className="flex flex-col items-center">
                          <div className="flex items-center justify-center">
                            <div>
                              <Image
                                src={creation.stills[currentIndex]}
                                alt="still"
                                className="rounded-lg w-auto h-72 object-cover"
                                width={500}
                                height={500}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Blessings */}
              <div>
                <Blessings blessings={creation?.blessings || []} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
