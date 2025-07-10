// components/abraham/creations/CreationList.tsx
import React from "react";
import { CreationItem } from "@/web-app/types";
import Creation from "./Creation";

interface CreationListProps {
  creations: CreationItem[];
}

export default function CreationList({ creations }: CreationListProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl">
      {creations.map((creation) => {
        return <Creation key={creation.id} creation={creation} />;
      })}
    </div>
  );
}
