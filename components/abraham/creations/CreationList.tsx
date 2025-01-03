// components/abraham/creations/CreationList.tsx
import React from "react";
import { CreationItem } from "@/types";
import Creation from "./Creation";

interface CreationListProps {
  creations: CreationItem[];
  userPraises: Set<string>;
}

export default function CreationList({
  creations,
  userPraises,
}: CreationListProps) {
  if (creations.length === 0) {
    return <p>No creations available.</p>;
  }
  console.log("userPraises:", userPraises);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl">
      {creations.map((creation) => (
        <>
          <Creation
            key={creation.id}
            creation={creation}
            hasPraised={userPraises.has(creation.id) ? true : false}
          />
        </>
      ))}
    </div>
  );
}
