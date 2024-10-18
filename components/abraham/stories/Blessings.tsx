import React from "react";
import Image from "next/image";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
//replace with actual user image
const profileImage = "";
const userAccounts = "0x641f5ffC5F6239A0873";

export default function Blessings({
  blessings,
}: {
  blessings: [{ blessing: string; user: string }];
}) {
  return (
    <div className="flex flex-col items-center justify-center ">
      {blessings.map((blessing, index) => (
        <div
          key={index}
          className="grid grid-cols-12 flex flex-col border-b border-gray-300 p-4 lg:w-[43vw]"
        >
          <div className="col-span-1 flex flex-col mr-3">
            {profileImage ? (
              <Image
                src={profileImage}
                alt={"user image"}
                width={100}
                height={100}
                className="rounded-full aspect-[1] object-cover border"
              />
            ) : (
              <div className="border rounded-full overflow-hidden">
                <RandomPixelAvatar
                  username={userAccounts || "username"}
                  size={32}
                />
              </div>
            )}
          </div>

          <div className="col-span-11 flex flex-col ">
            <div className="text-gray-700">{blessing.blessing}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
