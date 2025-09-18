"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useEdenSession } from "@/hooks/use-eden-session";
import type { SessionV2 } from "@edenlabs/eden-sdk";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pin } from "lucide-react";

function SessionsList({ agentId }: { agentId?: string }) {
  const { listSessions, loading } = useEdenSession();
  const [sessions, setSessions] = useState<SessionV2[]>([]);

  useEffect(() => {
    (async () => {
      const res = await listSessions({
        limit: 20,
        ...(agentId && { agent_id: agentId }),
      });
      setSessions(res?.results || []);
    })();
  }, [listSessions, agentId]);

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <Link key={s._id} href={`/chat/${s._id}`}>
          <Card className="hover:shadow-sm transition-shadow border-md">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    {s.title || `Session ${s._id.slice(-6)}`}
                    {s.pinned && <Pin className="h-4 w-4 text-yellow-500" />}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs rounded-md">
                      {s.messages?.length || 0} messages
                    </Badge>
                    <Badge variant="secondary" className="text-xs rounded-md">
                      {s.status}
                    </Badge>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(s.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
      {sessions.length === 0 && (
        <div className="text-sm text-gray-500">No sessions yet.</div>
      )}
    </div>
  );
}

export default SessionsList;
