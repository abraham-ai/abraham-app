// components/abraham/creations/CreationList.tsx
import React from "react";
import { CreationItem } from "@/types";
import Creation from "./Creation";

interface CreationListProps {
  creations: CreationItem[];
  userPraises: Map<string, number>;
}

export default function CreationList({
  creations,
  userPraises,
}: CreationListProps) {
  console.log("User Praises:", userPraises);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl">
      {creations.map((creation) => {
        return (
          <Creation
            key={creation.id}
            creation={creation}
            hasPraised={userPraises.has(creation.id) ? true : false}
          />
        );
      })}
    </div>
  );
}
