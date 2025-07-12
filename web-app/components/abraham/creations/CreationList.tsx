// components/abraham/creations/CreationList.tsx
import React from "react";
import { CreationItem } from "@/types/abraham";
import Creation from "./Creation";

interface CreationListProps {
  creations: CreationItem[];
}

export default function CreationList({ creations }: CreationListProps) {
  return (
    <div className="flex flex-col items-center w-full max-w-4xl">
      {creations.map((c) => (
        <Creation key={c.id} creation={c} />
      ))}
    </div>
  );
}
