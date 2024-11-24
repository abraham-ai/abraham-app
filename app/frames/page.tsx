// app/frames/page.tsx
import React from "react";

export const dynamic = "force-dynamic"; // Ensure the page is not statically cached

async function fetchStories() {
  const apiUrl =
    "https://edenartlab--abraham-fastapi-app.modal.run/get_stories";
  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`Error fetching stories: ${res.statusText}`);
  }
  const stories = await res.json();
  return stories;
}

export default async function AbrahamFrame() {
  const stories = await fetchStories();
  const story = stories[0]; // Start with the first story

  const framePostUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/frames`;

  return (
    <html>
      <head>
        {/* Required Farcaster Frame meta tags */}
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content={story.poster_image} />
        <meta property="og:image" content={story.poster_image} />

        {/* Buttons */}
        <meta property="fc:frame:button:1" content="Praise" />
        <meta property="fc:frame:button:2" content="Burn" />
        <meta property="fc:frame:button:3" content="Next" />

        {/* Post URL for handling button clicks */}
        <meta property="fc:frame:post_url" content={framePostUrl} />
      </head>
      <body>
        {/* Content for web browsers */}
        <div style={{ textAlign: "center" }}>
          <h1>Abraham's Creation</h1>
          <img
            src={story.poster_image}
            alt={story.logline}
            style={{ maxWidth: "100%" }}
          />
          <p>{story.logline}</p>
        </div>
      </body>
    </html>
  );
}
