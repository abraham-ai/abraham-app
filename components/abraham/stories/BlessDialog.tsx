import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";

export default function BlessDialog({
  story,
  blessingsCount,
  setBlessingsCount,
}: {
  story: { id: string; logline: string };
  blessingsCount: number;
  setBlessingsCount: (count: number) => void;
}) {
  const { loggedIn, userInfo, idToken, userAccounts } = useAuth();
  const [blessingText, setBlessingText] = useState(""); // State for blessing text
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state for submit button

  const handleBlessSubmit = async () => {
    if (!idToken) {
      throw new Error("User not authenticated");
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/artlabproxy/stories/bless", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`, // JWT for authentication
        },
        body: JSON.stringify({
          story_id: story.id, // Story ID
          blessing: blessingText, // User's blessing/comment
        }),
      });

      if (response.ok) {
        setBlessingsCount(blessingsCount + 1); // Update blessing count after successful submission
      } else {
        throw new Error("Error submitting blessing");
      }

      // Reset blessing text after successful submission
      setBlessingText("");
    } catch (error) {
      console.error("Error submitting blessing:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog>
      {loggedIn ? (
        <DialogTrigger asChild>
          <MessageCircle
            className={`w-5 h-5 ${
              loggedIn ? "text-gray-500" : "text-gray-300 cursor-not-allowed"
            }`}
          />
        </DialogTrigger>
      ) : (
        <MessageCircle
          className={`w-5 h-5 ${
            loggedIn ? "text-gray-500" : "text-gray-300 cursor-not-allowed"
          }`}
        />
      )}
      <DialogContent className="sm:max-w-xl bg-white">
        <div className="grid grid-cols-12 mt-1">
          <div className="col-span-1 flex flex-col mr-3">
            <Image
              src={"/abrahamlogo.png"}
              alt={story.logline}
              width={100}
              height={100}
              className="rounded-full aspect-[1] object-cover border"
            />
            <div className="py-4 ml-4 border-l h-full"></div>
          </div>
          <div className="col-span-11 flex flex-col">
            <p className="text-gray-700 ">{story.logline}</p>
            <div className="py-3"></div>
          </div>
        </div>
        <div className="grid grid-cols-12">
          <div className="col-span-1 flex flex-col mr-3">
            <div>
              {userInfo?.profileImage && (
                <Image
                  src={userInfo?.profileImage}
                  alt={"user image"}
                  width={100}
                  height={100}
                  className="rounded-full aspect-[1] object-cover border"
                />
              )}
              {!userInfo?.profileImage && (
                <div className="rounded-full overflow-hidden">
                  <RandomPixelAvatar
                    username={userAccounts || "username"}
                    size={32}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="col-span-11 flex flex-col ">
            <Textarea
              value={blessingText}
              onChange={(e) => setBlessingText(e.target.value)} // Update state on text change
              className="w-full border-0 text-lg -mt-2 -ml-3"
              placeholder="Share a blessing or a kind thought..."
            />
          </div>
        </div>
        <DialogFooter>
          {loggedIn && (
            <Button
              type="submit"
              className="px-8"
              onClick={handleBlessSubmit}
              disabled={isSubmitting || !blessingText} // Disable while submitting or if text is empty
            >
              {isSubmitting ? "Blessing..." : "Bless"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
