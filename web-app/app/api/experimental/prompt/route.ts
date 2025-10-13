import { NextRequest, NextResponse } from "next/server";
import { env, sessionConfig } from "@/lib/config";

export async function POST(request: NextRequest) {
  // For now, use the server-side admin key for Eden
  const adminKey = process.env.ABRAHAM_EDEN_ADMIN_API_KEY;

  if (!adminKey) {
    return new NextResponse(
      JSON.stringify({ message: "Missing ABRAHAM_EDEN_ADMIN_API_KEY" }),
      { status: 500 }
    );
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
    const baseHeaders = {
      "Content-Type": "application/json",
      "X-Api-Key": adminKey,
    } as Record<string, string>;

    let effectiveSessionId: string | undefined = requestJson.session_id;

    if (!effectiveSessionId) {
      const createPayload = {
        agent_ids: requestJson.agent_ids,
        scenario: requestJson.scenario,
        budget: requestJson.budget,
        title: requestJson.title,
        autonomy_settings: requestJson.autonomy_settings,
      } as any;

      const createRes = await fetch(
        `${env.NEXT_PUBLIC_EDEN_API_URL}/v2/sessions/create`,
        {
          method: "POST",
          headers: baseHeaders,
          body: JSON.stringify(createPayload),
        }
      );

      if (!createRes.ok) {
        let errorBody: any = null;
        try {
          errorBody = await createRes.json();
        } catch {
          const errText = await createRes.text().catch(() => "");
          errorBody = errText || { message: "Failed to create session" };
        }
        return new NextResponse(
          typeof errorBody === "string" ? errorBody : JSON.stringify(errorBody),
          { status: createRes.status }
        );
      }

      const created = await createRes.json().catch(() => null);
      effectiveSessionId =
        created?.session?._id ||
        created?.session?.id ||
        created?.session_id ||
        created?.sessionId;

      if (!effectiveSessionId) {
        return new NextResponse(
          JSON.stringify({ message: "Session created but ID missing" }),
          { status: 500 }
        );
      }
    }

    const messagePayload = {
      session_id: effectiveSessionId,
      content: requestJson.content || "",
      attachments: requestJson.attachments || [],
      stream: !!sessionConfig.useStreaming,
      thinking: requestJson.thinking || false,
      // include agent_ids to ensure correct routing in multi-agent setups
      ...(requestJson.agent_ids ? { agent_ids: requestJson.agent_ids } : {}),
    } as any;

    const response = await fetch(
      `${env.NEXT_PUBLIC_EDEN_API_URL}/v2/sessions`,
      {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(messagePayload),
      }
    );
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
    console.error("Streaming error:", error);
    return new NextResponse(JSON.stringify({ message: "Stream failed" }), {
      status: 500,
    });
  }
}
