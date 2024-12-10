import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

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

// Fetch a single creation by ID
async function fetchCreationById(creationId: string): Promise<Creation> {
  const apiUrl = `https://edenartlab--abraham2-fastapi-app.modal.run/get_creation?creation_id=${creationId}`;
  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`Error fetching creation: ${res.statusText}`);
  }
  const creation = await res.json();
  return creation;
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
    console.error(
      `Error performing ${action} on creation ${creation_id}:`,
      error
    );
    throw error;
  }
}

function generateFrameHtml(creation: Creation) {
  const framePostUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/frames/creation?creationId=${creation._id}`;

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

        <meta property="fc:frame:button:1" content="🙌 ${praisesCount}" />
        <meta property="fc:frame:button:2" content="🔥 ${burnsCount}" />

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

/**
 * GET /api/frames/creation?creationId=<id>
 * Fetch and return a single creation as a Farcaster Frame.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const creationId = searchParams.get("creationId");

  if (!creationId) {
    return NextResponse.json(
      { error: "creationId parameter is required" },
      { status: 400 }
    );
  }

  try {
    const creation = await fetchCreationById(creationId);
    const frameHtml = generateFrameHtml(creation);

    return new Response(frameHtml, {
      headers: { "Content-Type": "text/html" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error fetching creation frame:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/frames/creation?creationId=<id>
 * Handle user interactions (praise or burn) for the specified creation.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const creationId = searchParams.get("creationId");

  if (!creationId) {
    return NextResponse.json(
      { error: "creationId parameter is required" },
      { status: 400 }
    );
  }

  try {
    const { untrustedData } = await request.json();
    const buttonIndex = untrustedData.buttonIndex;

    // Fetch the creation to ensure it exists and to get initial counts
    await fetchCreationById(creationId);

    if (buttonIndex === 1) {
      // Praise
      await sendReaction(creationId, "praise");
    } else if (buttonIndex === 2) {
      // Burn
      await sendReaction(creationId, "burn");
    } else {
      return NextResponse.json(
        { error: "Invalid button index" },
        { status: 400 }
      );
    }

    // Fetch the updated creation to get updated counts
    const updatedCreation = await fetchCreationById(creationId);
    const frameHtml = generateFrameHtml(updatedCreation);

    return new Response(frameHtml, {
      headers: { "Content-Type": "text/html" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error handling user interaction:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
