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
import { useAuth } from "@/context/AuthContext";

export default function CreationPage({ params }: { params: { id: string } }) {
  const [creation, setCreation] = useState<CreationItem | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userPraises, setUserPraises] = useState<Set<string>>(new Set());
  const { loggedIn, userAccounts } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchData();
  }, [loggedIn, userAccounts]);

  // Fetch all creations and find the one with the matching ID
  const fetchCreation = async () => {
    try {
      axios
        .get(`/api/creations/creation?creationId=${params.id}`)
        .then((res) => {
          console.log("Creation:", res.data);
          setCreation(res.data);
        });
    } catch (err: any) {
      console.error("Fetch Error:", err);
    }
  };

  const fetchUserPraises = async () => {
    if (!loggedIn || !userAccounts || userAccounts.length === 0) return;
    console.log("User Accounts: ", userAccounts);
    const userAddress = userAccounts.toLowerCase();
    console.log("User Address: ", userAddress);

    const query = `
      query GetUserPraises($user: Bytes!) {
        praiseds(where: { user: $user }) {
          creationId
        }
      }
    `;

    try {
      const response = await fetch(
        "https://api.studio.thegraph.com/query/99814/abraham-ai/v0.0.2",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables: { user: userAddress } }),
        }
      );

      if (!response.ok)
        throw new Error(`Network error: ${response.statusText}`);

      const { data, errors } = await response.json();
      console.log("User Praises Data:", data);
      if (errors) {
        console.error("GraphQL Errors:", errors);
        return;
      }

      const praisedIds = data.praiseds.map((p: any) => p.creationId);
      setUserPraises(new Set(praisedIds));
    } catch (err: any) {
      console.error("Error fetching user praises:", err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    await fetchCreation();
    await fetchUserPraises();
    setLoading(false);
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
            <div className="flex flex-col items-center justify-center border-x ">
              <div>{creation && <Creation creation={creation} />}</div>
              {/*
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
              
             
              */}
              <div>
                <Blessings
                  blessings={
                    creation?.blessings.map((b) => ({
                      ...b,
                      user: b.userAddress,
                      blessing: b.message,
                    })) || []
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
