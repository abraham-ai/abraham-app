import { handleAxiosServerError } from "@/lib/eden-fetcher";
import { EdenClient } from "@edenlabs/eden-sdk";
import { NextRequest, NextResponse } from "next/server";

// Eden client constructed only with server-side API key.
function getEdenClient() {
  return new EdenClient({
    edenApiUrl: process.env.NEXT_PUBLIC_EDEN_API_URL,
    apiKey: process.env.ABRAHAM_EDEN_ADMIN_API_KEY,
  });
}

export async function GET(
  request: NextRequest,
  { params: { id } }: { params: { id: string } }
) {
  if (!id) {
    return new NextResponse(JSON.stringify({ message: "Missing id" }), {
      status: 400,
    });
  }

  try {
    const eden = getEdenClient();

    const res = await eden.sessions.v2.get({ session_id: id });

    if (!res) {
      return new NextResponse(
        JSON.stringify({ message: "Session not found" }),
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(res);
  } catch (error) {
    const errorMessage = handleAxiosServerError(error);
    console.error(errorMessage);
    return new NextResponse(JSON.stringify({ message: errorMessage }), {
      status: 500,
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params: { id } }: { params: { id: string } }
) {
  if (!id) {
    return new NextResponse(JSON.stringify({ message: "Missing id" }), {
      status: 400,
    });
  }

  try {
    const eden = getEdenClient();

    const res = await eden.sessions.v2.delete({ session_id: id });

    if (!res.success) {
      return new NextResponse(JSON.stringify({ message: res.error }), {
        status: 500,
      });
    }

    return NextResponse.json(res);
  } catch (error) {
    const errorMessage = handleAxiosServerError(error);
    console.error(errorMessage);
    return new NextResponse(JSON.stringify({ message: errorMessage }), {
      status: 500,
    });
  }
}

export async function PATCH(
  request: NextRequest,
  { params: { id } }: { params: { id: string } }
) {
  const body = await request.json();
  const { title, pinned } = body;

  if (title === undefined && pinned === undefined) {
    return new NextResponse(
      JSON.stringify({ message: "Missing title or pinned status" }),
      {
        status: 400,
      }
    );
  }

  try {
    const eden = getEdenClient();

    const updateData: { session_id: string; title?: string; pinned?: boolean } =
      { session_id: id };
    if (title !== undefined) {
      updateData.title = title;
    }
    if (pinned !== undefined) {
      updateData.pinned = pinned;
    }

    const res = await eden.sessions.v2.rename(updateData);

    return NextResponse.json(res);
  } catch (error) {
    const errorMessage = handleAxiosServerError(error);
    console.error(errorMessage);
    return new NextResponse(JSON.stringify({ message: errorMessage }), {
      status: 500,
    });
  }
}
