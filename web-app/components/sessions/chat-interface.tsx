"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send } from "lucide-react";
import { useEdenSession } from "@/hooks/use-eden-session";
import type { SessionV2 } from "@edenlabs/eden-sdk";

type LocalMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "eden" | "tool";
  content: string;
  createdAt: number;
  pending?: boolean;
};

function ChatInterface({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionV2 | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { getSession } = useEdenSession();

  const isSessionRoute = useMemo(
    () => pathname?.startsWith("/chat/") ?? false,
    [pathname]
  );

  useEffect(() => {
    // Hydrate from draft cache if matching
    try {
      const draftRaw = sessionStorage.getItem("eden-chat-draft");
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        if (
          draft?.sessionId &&
          draft.sessionId === sessionId &&
          Array.isArray(draft.messages)
        ) {
          setMessages(draft.messages as LocalMessage[]);
        }
      }
    } catch {}

    if (!sessionId) return;
    (async () => {
      const s = await getSession(sessionId);
      if (s) {
        setSession(s);
        const mapped = (s.messages || []).map((m: any) => ({
          id: m._id || String(Math.random()),
          role: m.role || m.author?.role || "assistant",
          content: m.content || m.message || "",
          createdAt: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
        }));
        setMessages(mapped);
        try {
          const draftRaw2 = sessionStorage.getItem("eden-chat-draft");
          if (draftRaw2) {
            const draft = JSON.parse(draftRaw2);
            if (draft?.sessionId === s._id)
              sessionStorage.removeItem("eden-chat-draft");
          }
        } catch {}
        setTimeout(
          () => scrollRef.current?.scrollIntoView({ behavior: "smooth" }),
          0
        );
      }
    })();
  }, [sessionId, getSession]);

  const pollSessionUntilReply = useCallback(
    async (id: string, timeoutMs = 20000, intervalMs = 800) => {
      const start = Date.now();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const s = await getSession(id);
        if (s && Array.isArray(s.messages)) {
          const hasAssistant = s.messages.some((m: any) => {
            const role = m.role || m.author?.role;
            return role === "assistant" || role === "eden" || role === "system";
          });
          if (hasAssistant) {
            return s;
          }
        }
        if (Date.now() - start >= timeoutMs) return s || null;
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    },
    [getSession]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setError(null);

      const optimistic: LocalMessage = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
        createdAt: Date.now(),
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      setInput("");
      setLoading(true);

      try {
        const payload: any = {
          content: text,
          thinking: false,
        };
        // Always include agent_ids to ensure correct routing
        const envAgentId = process.env.NEXT_PUBLIC_ABRAHAM_AGENT_ID as
          | string
          | undefined;
        const agentIds = ["675f880479e00297cd9b4688"].filter(
          Boolean
        ) as string[];
        if (agentIds.length) payload.agent_ids = agentIds;
        // Include session_id when we're in an existing session
        if (session?._id) {
          payload.session_id = session._id;
        }

        const res = await axios.post("/api/sessions/prompt", payload);

        if (res.data?.session) {
          const full: SessionV2 = res.data.session;
          setSession(full);
          const mapped = (full.messages || []).map((m: any) => ({
            id: m._id || String(Math.random()),
            role: m.role || m.author?.role || "assistant",
            content: m.content || m.message || "",
            createdAt: m.createdAt
              ? new Date(m.createdAt).getTime()
              : Date.now(),
          }));
          setMessages(mapped);

          if (!isSessionRoute) {
            try {
              sessionStorage.setItem(
                "eden-chat-draft",
                JSON.stringify({ sessionId: full._id, messages: mapped })
              );
            } catch {}
            router.replace(`/chat/${full._id}`);
          }
        } else if (res.data?.session_id) {
          // Only ID returned; poll until assistant reply appears
          const newId = res.data.session_id as string;
          const targetSessionId = session?._id ? session._id : newId;
          const polled = await pollSessionUntilReply(targetSessionId);
          if (polled) {
            setSession(polled);
            const mapped = (polled.messages || []).map((m: any) => ({
              id: m._id || String(Math.random()),
              role: m.role || m.author?.role || "assistant",
              content: m.content || m.message || "",
              createdAt: m.createdAt
                ? new Date(m.createdAt).getTime()
                : Date.now(),
            }));
            setMessages(mapped);
          }
          if (!isSessionRoute) {
            try {
              sessionStorage.setItem(
                "eden-chat-draft",
                JSON.stringify({ sessionId: newId, messages })
              );
            } catch {}
            router.replace(`/chat/${newId}`);
          }
        } else if (res.data?.message) {
          setError(res.data.message);
        }
      } catch (e: any) {
        setError(
          e?.response?.data?.message || e.message || "Failed to send message"
        );
      } finally {
        setLoading(false);
        setTimeout(
          () => scrollRef.current?.scrollIntoView({ behavior: "smooth" }),
          0
        );
      }
    },
    [
      getSession,
      isSessionRoute,
      router,
      session?._id,
      sessionId,
      pollSessionUntilReply,
      messages,
    ]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await sendMessage(input);
    },
    [sendMessage, input]
  );

  return (
    <div className="w-full max-w-2xl">
      <Card className="border-md">
        <CardContent className="p-4">
          <div className="mb-3 text-sm text-gray-600">
            {session?._id ? (
              <span>Session: {session.title || session._id.slice(-6)}</span>
            ) : (
              <span>Start a new conversation</span>
            )}
          </div>

          <ScrollArea className="h-[60vh] w-full rounded-md border border-gray-200 bg-white p-3">
            <div className="space-y-3 pr-2">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-8">
                  No messages yet. Say hello!
                </div>
              )}
              {messages.map((m) => {
                const isAssistant =
                  m.role === "assistant" ||
                  m.role === "eden" ||
                  m.role === "system";
                return (
                  <div
                    key={m.id}
                    className={`flex ${
                      isAssistant ? "justify-start" : "justify-end"
                    }`}
                  >
                    <div
                      className={`max-w-[75%] rounded-md px-3 py-2 text-sm shadow-sm border whitespace-pre-wrap break-words ${
                        isAssistant
                          ? "bg-gray-50 border-gray-200"
                          : "bg-blue-50 border-blue-200"
                      }`}
                    >
                      <div className="leading-relaxed text-gray-800">
                        {m.content}
                        {m.pending && (
                          <span className="ml-2 inline-flex items-center text-xs text-gray-400">
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />{" "}
                            sending
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[10px] text-gray-400">
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {error && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="rounded-md"
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-md"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default ChatInterface;
