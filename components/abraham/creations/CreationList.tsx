import React from "react";
import { CreationItem } from "@/types";
import Creation from "./Creation";

interface CreationListProps {
  creations: CreationItem[];
}

export default function CreationList({ creations }: CreationListProps) {
  if (creations.length === 0) {
    return <p>No creations available.</p>;
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-4xl">
      {creations.map((creation) => (
        <Creation key={creation.id} creation={creation} />
      ))}
    </div>
  );
}
