"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import CreationList from "@/components/abraham/creations/CreationList";
import AppBar from "@/components/layout/AppBar";

export default function Home() {
  const [creations, setCreations] = useState([]);

  useEffect(() => {
    axios.get("/api/artlabproxy/stories").then((res) => {
      setCreations(res.data);
      console.log("Creations:", res.data);
    });
  }, []);

  return (
    <>
      <div>
        <AppBar />
        <div className="mt-12 flex flex-col items-center justify-center w-full">
          <CreationList creations={creations || []} />
        </div>
      </div>
    </>
  );
}
