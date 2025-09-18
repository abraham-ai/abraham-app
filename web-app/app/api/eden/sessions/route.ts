import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { env, sessionConfig } from "@/lib/config";

export async function POST(request: NextRequest) {
  const authToken = await getAuthToken(request);

  if (!authToken) {
    return new NextResponse(JSON.stringify({ message: "Not authenticated" }), {
      status: 401,
    });
  }

  const requestJson = await request.json().catch(() => null);

  if (!requestJson) {
    return new NextResponse(JSON.stringify({ message: "No data passed" }), {
      status: 400,
    });
  }

  if (
    !requestJson.content &&
    !(requestJson.attachments && requestJson.attachments.length)
  ) {
    return new NextResponse(
      JSON.stringify({ message: "Neither content nor attachments passed" }),
      { status: 400 }
    );
  }

  if (!requestJson.session_id && !requestJson.agent_ids) {
    return new NextResponse(
      JSON.stringify({
        message: "agent_ids required when creating new session",
      }),
      { status: 400 }
    );
  }

  try {
    const payload = {
      session_id: requestJson.session_id,
      content: requestJson.content || "",
      attachments: requestJson.attachments || [],
      stream: !!sessionConfig.useStreaming,
      thinking: requestJson.thinking || false,
      agent_ids: requestJson.agent_ids,
      ...(requestJson.session_id
        ? {}
        : {
            scenario: requestJson.scenario,
            budget: requestJson.budget,
            title: requestJson.title,
            autonomy_settings: requestJson.autonomy_settings,
          }),
    } as any;

    const useApiKeyHeader =
      authToken === process.env.ABRAHAM_EDEN_ADMIN_API_KEY;
    const response = await fetch(
      `${env.NEXT_PUBLIC_EDEN_API_URL}/v2/sessions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(useApiKeyHeader
            ? { "X-Api-Key": authToken }
            : { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      let errorBody: any = null;
      try {
        errorBody = await response.json();
      } catch {
        const errText = await response.text().catch(() => "");
        errorBody = errText || { message: "Failed to send message" };
      }
      return new NextResponse(
        typeof errorBody === "string" ? errorBody : JSON.stringify(errorBody),
        { status: response.status }
      );
    }

    if (sessionConfig.useStreaming) {
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("Eden sessions proxy error:", error);
    return new NextResponse(JSON.stringify({ message: "Proxy failed" }), {
      status: 500,
    });
  }
}
