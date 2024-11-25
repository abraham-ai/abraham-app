"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import StoryList from "@/components/abraham/stories/StoryList";
import AppBar from "@/components/layout/AppBar";

export default function Home() {
  const [stories, setStories] = useState([]);

  useEffect(() => {
    axios.get("/api/artlabproxy/stories").then((res) => {
      setStories(res.data);
      console.log("Stories:", res.data);
    });
  }, []);

  return (
    <>
      <div>
        <AppBar />
        <div className="mt-12 flex flex-col items-center justify-center w-full">
          <StoryList stories={stories || []} />
        </div>
      </div>
    </>
  );
}
