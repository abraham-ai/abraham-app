import React from "react";
import { CreationItem } from "@/types";
import Creation from "./Creation";

export default function CreationList({
  creations,
}: {
  creations: CreationItem[];
}) {
  return (
    <div className="flex flex-col items-center justify-center ">
      <div className="border-x ">
        {creations.map((creation, index) => (
          <Creation key={index} creation={creation} />
        ))}
      </div>
    </div>
  );
}
