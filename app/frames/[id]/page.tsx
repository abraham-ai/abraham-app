import React from "react";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// Fetch a single creation by ID
async function fetchCreationById(creationId: string) {
  const apiUrl =
    "https://edenartlab--abraham2-fastapi-app.modal.run/get_creations";
  const res = await fetch(apiUrl);

  if (!res.ok) {
    throw new Error(`Error fetching creations: ${res.statusText}`);
  }
  console.log("res", res);
  const creations = await res.json();
  console.log("creations", creations);
  const creation = creations.find((c: any) => c._id === creationId);
  console.log("creation", creation);
  return creation;
}

interface Creation {
  _id: string;
  creation: {
    title: string;
    description: string;
    visual_aesthetic: string;
  };
  result: {
    output: [
      {
        mediaAttributes: {
          mimeType: string;
          width: number;
          height: number;
          aspectRatio: number;
        };
        url: string;
      }
    ];
    status: string;
  };
  praises: string[];
  burns: string[];
}

interface PageProps {
  params: { id: string };
}

export default async function CreationFrame({ params }: PageProps) {
  const { id } = params;
  const creationId = id;

  let creation: Creation;
  try {
    creation = await fetchCreationById(creationId);
  } catch (error) {
    console.error("Error fetching creation:", error);
    notFound();
  }

  if (!creation) {
    notFound();
  }

  const imageUrl = creation.result.output[0]?.url || "";
  const title = creation.creation.title;
  const praisesCount = creation.praises.length || 0;
  const burnsCount = creation.burns.length || 0;

  // The frame server interaction endpoint
  const framePostUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/frames/creation?creationId=${creation._id}`;

  return (
    <html>
      <head>
        {/* Required Farcaster Frame meta tags */}
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={imageUrl} />
        <meta property="og:image" content={imageUrl} />

        {/* Buttons (Praise and Burn only) */}
        <meta property="fc:frame:button:1" content={`🙌 ${praisesCount}`} />
        <meta property="fc:frame:button:2" content={`🔥 ${burnsCount}`} />

        {/* Post URL for handling button clicks */}
        <meta property="fc:frame:post_url" content={framePostUrl} />
      </head>
      <body>
        {/* Content for web browsers */}
        <div style={{ textAlign: "center" }}>
          <h1>{"Abraham's Creation"}</h1>
          <img src={imageUrl} alt={title} style={{ maxWidth: "100%" }} />
          <p>{title}</p>
        </div>
      </body>
    </html>
  );
}
