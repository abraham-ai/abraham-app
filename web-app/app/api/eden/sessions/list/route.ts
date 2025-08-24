import {
  extractPaginationParams,
  handleAxiosServerError,
} from "@/lib/eden-fetcher";
import { EdenClient } from "@edenlabs/eden-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const paginationParams = extractPaginationParams(
    request.nextUrl.searchParams
  );

  try {
    const eden = new EdenClient({
      edenApiUrl: process.env.NEXT_PUBLIC_EDEN_API_URL,
      apiKey: process.env.ABRAHAM_EDEN_ADMIN_API_KEY,
    });
    const res = await eden.sessions.v2.list({
      ...paginationParams,
      agent_id: request.nextUrl.searchParams.get("agent_id") || undefined,
    });

    return NextResponse.json(res);
  } catch (error) {
    const errorMessage = handleAxiosServerError(error);
    console.error(errorMessage);
    return new NextResponse(JSON.stringify({ message: errorMessage }), {
      status: 500,
    });
  }
}
