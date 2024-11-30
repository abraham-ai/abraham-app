import axios from "axios";
import { NextResponse } from "next/server";

interface Creation {
  id: string;
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

let creationsCache: Creation[] = [];
let currentIndex = 0;

// Fetch creations from the external API
async function fetchCreations() {
  if (creationsCache.length === 0) {
    try {
      const response = await fetch(
        "https://edenartlab--abraham2-fastapi-app.modal.run/get_creations"
      );

      if (!response.ok) {
        throw new Error(`Error fetching creations: ${response.statusText}`);
      }

      const creations = await response.json();
      creationsCache = creations;
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error fetching creations:", error.message);
      } else {
        console.error("Error fetching creations:", error);
      }
    }
  }
  return creationsCache;
}

// Send reaction to the external API
async function sendReaction(creation_id: string, action: string) {
  const apiUrl = "https://edenartlab--abraham2-fastapi-app.modal.run/react";
  const actionData = {
    creation_id,
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
        `Error performing ${action} on creation ${creation_id}:`,
        error.message
      );
    } else {
      console.error(
        `Error performing ${action} on creation ${creation_id}:`,
        error
      );
    }
    throw error;
  }
}

/**
 * GET /api/frames - Fetch the current creation frame
 */
export async function GET(request: Request) {
  try {
    const creations = await fetchCreations();
    const currentCreation = creations[currentIndex];
    const frameHtml = generateFrameHtml(currentCreation);

    return new Response(frameHtml, {
      headers: { "Content-Type": "text/html" },
      status: 200,
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error fetching creation frame:", error.message);
    } else {
      console.error("Error fetching creation frame:", error);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/frames - Handle user interactions with the creation
 */
export async function POST(request: Request) {
  try {
    const { untrustedData } = await request.json();
    const buttonIndex = untrustedData.buttonIndex;

    const creations = await fetchCreations();
    const currentCreation = creations[currentIndex];

    if (buttonIndex === 1) {
      // Add a dummy praise for demonstration purposes
      currentCreation.praises.push("dummy_user"); // Update the local cache
      await sendReaction(currentCreation.id, "praise");
    } else if (buttonIndex === 2) {
      // Add a dummy burn for demonstration purposes
      currentCreation.burns.push("dummy_user"); // Update the local cache
      await sendReaction(currentCreation.id, "burn");
    } else if (buttonIndex === 3) {
      currentIndex = (currentIndex + 1) % creations.length;
    } else {
      return NextResponse.json(
        { error: "Invalid button index" },
        { status: 400 }
      );
    }

    const newCreation = creations[currentIndex];
    const frameHtml = generateFrameHtml(newCreation);
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

function generateFrameHtml(creation: Creation) {
  const framePostUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/frames`;

  const imageUrl = creation.result.output[0]?.url || "";
  const title = creation.creation.title;
  const praisesCount = creation.praises.length || 0;
  const burnsCount = creation.burns.length || 0;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="fc:frame" content="vNext" />
        <meta property="fc:frame:image" content="${imageUrl}" />
        <meta property="og:image" content="${imageUrl}" />

        <meta property="fc:frame:button:1" content=" 🙌 ${praisesCount}" />
        <meta property="fc:frame:button:2" content="🔥 ${burnsCount}" />
        <meta property="fc:frame:button:3" content="Next" />

        <meta property="fc:frame:post_url" content="${framePostUrl}" />
      </head>
      <body>
        <div style="text-align: center;">
          <h1>Abraham's Creation</h1>
          <img src="${imageUrl}" alt="${title}" style="max-width: 100%;" />
          <p>${title}</p>
        </div>
      </body>
    </html>
  `;
}
