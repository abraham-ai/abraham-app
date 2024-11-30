import React from "react";

export const dynamic = "force-dynamic"; // Ensure the page is not statically cached

async function fetchCreations() {
  const apiUrl =
    "https://edenartlab--abraham2-fastapi-app.modal.run/get_creations";
  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`Error fetching creations: ${res.statusText}`);
  }
  const creations = await res.json();
  return creations;
}

export default async function AbrahamFrame() {
  const creations = await fetchCreations();
  const creation = creations[0]; // Start with the first creation

  const imageUrl = creation.result.output[0]?.url || "";
  const title = creation.artwork.title;
  const praisesCount = creation.praises.length || 0;
  const burnsCount = creation.burns.length || 0;

  const framePostUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/frames`;

  return (
    <html>
      <head>
        {/* Required Farcaster Frame meta tags */}
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={imageUrl} />
        <meta property="og:image" content={imageUrl} />

        {/* Buttons */}
        <meta property="fc:frame:button:1" content={`🙌 ${praisesCount}`} />
        <meta property="fc:frame:button:2" content={`🔥 ${burnsCount}`} />
        <meta property="fc:frame:button:3" content="Next" />

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
