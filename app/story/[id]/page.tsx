"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import Story from "@/components/abraham/stories/Story";
import AppBar from "@/components/layout/AppBar";
import { StoryItem } from "@/types";
import Blessings from "@/components/abraham/stories/Blessings";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import Image from "next/image";

export default function Home({ params }: { params: { id: string } }) {
  const [story, setStory] = useState<StoryItem | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Maybe change later to get a single story
    axios.get("/api/artlabproxy/stories").then((res) => {
      // Filter story by id and return object
      const filteredStory: StoryItem | null =
        res.data.find((story: StoryItem) => {
          return story.id === params.id;
        }) || null;

      setStory(filteredStory);
      console.log("Story:", filteredStory);
    });
  }, []);

  // Function to go to the next slide
  const nextSlide = () => {
    if (story && story.stills.length > 0) {
      setCurrentIndex((prevIndex) =>
        prevIndex === story.stills.length - 1 ? 0 : prevIndex + 1
      );
    }
  };

  // Function to go to the previous slide
  const prevSlide = () => {
    if (story && story.stills.length > 0) {
      setCurrentIndex((prevIndex) =>
        prevIndex === 0 ? story.stills.length - 1 : prevIndex - 1
      );
    }
  };

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
              <div>{story && <Story story={story} />}</div>
              {/* Stills */}
              {story?.stills && story.stills.length > 0 && (
                <div className="grid grid-cols-12 border-b p-4 lg:w-[43vw]">
                  <div className="col-span-1 flex flex-col mr-3">
                    <Image
                      src={"/abrahamlogo.png"}
                      alt={"abrahaml"}
                      width={100}
                      height={100}
                      className="rounded-full aspect-[1] object-cover border"
                    />
                  </div>
                  <div className="col-span-11 flex flex-col pr-4">
                    {/* <p className="mb-1 mr-8">Stills</p> */}

                    <div className="grid grid-cols-12 ">
                      <div className="col-span-9 flex flex-col mr-0.5 mt-2">
                        {/* Simple Carousel */}
                        {story?.stills && story.stills.length > 0 && (
                          <div className="flex flex-col items-center">
                            <div className="flex items-center justify-center">
                              <div className="">
                                <Image
                                  src={story.stills[currentIndex]}
                                  alt="still"
                                  className="rounded-lg w-auto h-72 object-cover"
                                  width={500}
                                  height={500}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Thumbnails */}
                      <ScrollArea className="col-span-3 h-72 overflow-x-hidden mt-2">
                        <div className="">
                          <div className="flex flex-col justify-center space-y-0.5">
                            {story?.stills &&
                              story.stills.map((still, index) => (
                                <Image
                                  key={index}
                                  src={still}
                                  alt={`thumbnail-${index}`}
                                  className={`w-32 h-20  aspect-[1/1] object-cover rounded-lg cursor-pointer ${
                                    currentIndex === index
                                      ? "border-2 border-gray-700"
                                      : "opacity-80"
                                  }`}
                                  onClick={() => handleThumbnailClick(index)}
                                  width={500}
                                  height={500}
                                />
                              ))}
                          </div>
                        </div>
                      </ScrollArea>
                    </div>
                    <div className="flex items-center justify-center">
                      {/* Previous Button */}
                      <button
                        onClick={prevSlide}
                        className="border p-2 m-2 rounded-full shadow-sm"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {/* Next Button */}
                      <button
                        onClick={nextSlide}
                        className="border p-2 m-2 rounded-full shadow-sm"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Blessings */}
              <div>
                <Blessings blessings={story?.blessings || []} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
