import axios from "axios";
import { NextResponse } from "next/server";

let storiesCache: string[] = [];
let currentIndex = 0;

// Fetch stories from the external API
async function fetchStories() {
  if (storiesCache.length === 0) {
    try {
      const response = await axios.get(
        "https://edenartlab--abraham-fastapi-app.modal.run/get_stories"
      );
      storiesCache = response.data;
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error fetching stories:", error.message);
      } else {
        console.error("Error fetching stories:", error);
      }
    }
  }
  return storiesCache;
}

// Send reaction to the external API
async function sendReaction(story_id: string, action: string) {
  const apiUrl = "https://edenartlab--abraham-fastapi-app.modal.run/react";
  const actionData = {
    story_id,
    action,
    user: "anonymous",
  };

  try {
    const response = await axios.post(apiUrl, actionData, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ABRAHAM_ADMIN_KEY}`,
      },
    });
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        `Error performing ${action} on story ${story_id}:`,
        error.message
      );
    } else {
      console.error(`Error performing ${action} on story ${story_id}:`, error);
    }
    throw error;
  }
}

/**
 * GET /api/abraham-frame - Fetch the current story frame
 */
export async function GET(request: Request) {
  try {
    const stories = await fetchStories();
    const currentStory = JSON.parse(stories[currentIndex]);
    const frameHtml = generateFrameHtml(currentStory);

    return new Response(frameHtml, {
      headers: { "Content-Type": "text/html" },
      status: 200,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error fetching story frame:", error.message);
    } else {
      console.error("Error fetching story frame:", error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/abraham-frame - Handle user interactions with the story
 */
export async function POST(request: Request) {
  try {
    const { untrustedData } = await request.json();
    const buttonIndex = untrustedData.buttonIndex;

    const stories = await fetchStories();
    const currentStory = stories[currentIndex];

    if (buttonIndex === 1) {
      const parsedStory = JSON.parse(currentStory);
      await sendReaction(parsedStory.id, "praise");
      await sendReaction(parsedStory.id, "burn");
    } else if (buttonIndex === 3) {
      currentIndex = (currentIndex + 1) % stories.length;
    } else {
      return NextResponse.json(
        { error: "Invalid button index" },
        { status: 400 }
      );
    }

    const newStory = stories[currentIndex];
    const parsedNewStory = JSON.parse(newStory);
    const frameHtml = generateFrameHtml(parsedNewStory);
    return new Response(frameHtml, {
      headers: { "Content-Type": "text/html" },
      status: 200,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error handling user interaction:", error.message);
    } else {
      console.error("Error handling user interaction:", error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function generateFrameHtml(story: { poster_image: string; logline: string }) {
  const framePostUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/frames`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${story.poster_image}" />
        <meta property="og:image" content="${story.poster_image}" />

        <meta property="fc:frame:button:1" content="Praise" />
        <meta property="fc:frame:button:2" content="Burn" />
        <meta property="fc:frame:button:3" content="Next" />

        <meta property="fc:frame:post_url" content="${framePostUrl}" />
      </head>
      <body>
        <div style="text-align: center;">
          <h1>Abraham's Creation</h1>
          <img src="${story.poster_image}" alt="${story.logline}" style="max-width: 100%;" />
          <p>${story.logline}</p>
        </div>
      </body>
    </html>
  `;
}
