"use client";

import { useState, useEffect } from "react";
import {
  useEdenSession,
  SessionListResponse,
} from "@/hooks/experimental/use-eden-session";
import { SessionV2 } from "@edenlabs/eden-sdk";
import { useToast } from "@/hooks/use-toast";
import AppBar from "@/components/layout/AppBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Pin,
  Trash2,
  Edit,
  Eye,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TestEdenSessionsPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<SessionV2[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionV2 | null>(
    null
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [agentFilter, setAgentFilter] = useState(
    process.env.NEXT_PUBLIC_ABRAHAM_AGENT_ID || ""
  );
  const [showAllMessages, setShowAllMessages] = useState(false);

  const {
    loading,
    error,
    listSessions,
    getSession,
    renameSession,
    pinSession,
    unpinSession,
    deleteSession,
    clearError,
  } = useEdenSession({
    onError: (error) => {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    },
    onSuccess: (message) => {
      toast({
        title: "Success",
        description: message,
      });
    },
  });

  // Load sessions on component mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const response = await listSessions({
      limit: 20,
      ...(agentFilter && { agent_id: agentFilter }),
    });

    if (!response) {
      setSessions([]);
      return;
    }

    // Defensive: ensure array
    const arr = Array.isArray(response.results) ? response.results : [];
    setSessions(arr);
  };

  const handleGetSession = async (sessionId: string) => {
    const session = await getSession(sessionId);
    if (session) {
      setSelectedSession(session);
    }
  };

  const handleRenameSession = async (sessionId: string) => {
    if (!newTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title",
        variant: "destructive",
      });
      return;
    }

    const success = await renameSession(sessionId, newTitle.trim());
    if (success) {
      await loadSessions();
      setEditingId(null);
      setNewTitle("");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const success = await deleteSession(sessionId);
    if (success) {
      setSessions((prev) =>
        prev.filter((session) => session._id !== sessionId)
      );
      if (selectedSession?._id === sessionId) {
        setSelectedSession(null);
      }
    }
  };

  const handleTogglePin = async (session: SessionV2) => {
    const success = session.pinned
      ? await unpinSession(session._id)
      : await pinSession(session._id);

    if (success) {
      await loadSessions();
    }
  };

  const startEditing = (session: SessionV2) => {
    setEditingId(session._id);
    setNewTitle(session.title || "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setNewTitle("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppBar />

      <div className="pt-20 px-4 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Eden Sessions Test Page
          </h1>
          <p className="text-gray-600">
            Test the useEdenSession hook functionality
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-6 border-md">
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter by Agent ID
                </label>
                <Input
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  placeholder="Enter agent ID to filter..."
                  className="rounded-md"
                />
                {process.env.NEXT_PUBLIC_ABRAHAM_AGENT_ID && (
                  <p className="text-xs text-gray-500 mt-1">
                    Using Abraham Agent ID from environment
                  </p>
                )}
              </div>
              <Button
                onClick={loadSessions}
                disabled={loading}
                className="rounded-md"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 border-md">
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-red-800 font-medium">Error</h3>
                  <p className="text-red-700">{error}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearError}
                  className="text-red-700 border-red-300 hover:bg-red-100 rounded-md"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sessions List */}
          <Card className="border-md">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">
                    Sessions ({sessions?.length || 0})
                  </CardTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    Showing first {sessions.length} of current page.
                  </p>
                </div>
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
            </CardHeader>
            <CardContent>
              {!loading && sessions.length === 0 && (
                <div className="text-center py-10 text-gray-500 border border-dashed rounded-md">
                  No sessions found
                </div>
              )}
              {loading && sessions.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  Loading sessions...
                </div>
              )}
              {sessions.length > 0 && (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <Card
                      key={session._id}
                      className="border border-gray-200 hover:shadow-md transition-shadow border-md"
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            {editingId === session._id ? (
                              <div className="flex gap-2 mb-2">
                                <Input
                                  value={newTitle}
                                  onChange={(e) => setNewTitle(e.target.value)}
                                  placeholder="Session title..."
                                  className="text-sm rounded-md"
                                />
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleRenameSession(session._id)
                                  }
                                  disabled={loading}
                                  className="rounded-md"
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditing}
                                  className="rounded-md"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                {session.title ||
                                  `Session ${session._id.slice(-6)}`}
                                {session.pinned && (
                                  <Pin className="h-4 w-4 text-yellow-500" />
                                )}
                              </h4>
                            )}

                            <div className="flex gap-2 mt-2">
                              <Badge
                                variant="secondary"
                                className="text-xs rounded-md"
                              >
                                {session.status}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-xs rounded-md"
                              >
                                {session.agents?.length || 0} agents
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-xs rounded-md"
                              >
                                {session.messages?.length || 0} messages
                              </Badge>
                            </div>

                            <p className="text-xs text-gray-500 mt-1">
                              ID: {session._id}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGetSession(session._id)}
                            className="rounded-md"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditing(session)}
                            disabled={editingId === session._id}
                            className="rounded-md"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTogglePin(session)}
                            disabled={loading}
                            className={`rounded-md ${
                              session.pinned ? "text-yellow-600" : ""
                            }`}
                          >
                            <Pin className="h-3 w-3 mr-1" />
                            {session.pinned ? "Unpin" : "Pin"}
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteSession(session._id)}
                            disabled={loading}
                            className="rounded-md"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session Details */}
          <Card className="border-md">
            <CardHeader>
              <CardTitle className="text-xl">Session Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedSession ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {selectedSession.title ||
                        `Session ${selectedSession._id.slice(-6)}`}
                      {selectedSession.pinned && (
                        <Pin className="h-4 w-4 text-yellow-500" />
                      )}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Status:</span>
                      <Badge variant="secondary" className="ml-2 rounded-md">
                        {selectedSession.status}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Pinned:</span>
                      <span className="ml-2">
                        {selectedSession.pinned ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Created:
                      </span>
                      <span className="ml-2 text-gray-600">
                        {new Date(
                          selectedSession.createdAt
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">
                        Updated:
                      </span>
                      <span className="ml-2 text-gray-600">
                        {new Date(
                          selectedSession.updatedAt
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Full ID:</h4>
                    <code className="text-xs bg-gray-100 p-2 rounded-md block break-all">
                      {selectedSession._id}
                    </code>
                  </div>

                  {selectedSession.scenario && (
                    <div>
                      <h4 className="font-medium text-gray-700 mb-2">
                        Scenario:
                      </h4>
                      <p className="text-sm bg-gray-50 p-3 rounded-md">
                        {selectedSession.scenario}
                      </p>
                    </div>
                  )}

                  {selectedSession.agents &&
                    selectedSession.agents.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700 mb-2">
                          Agents ({selectedSession.agents.length}):
                        </h4>
                        <div className="space-y-2">
                          {selectedSession.agents.map((agent) => (
                            <div
                              key={agent._id}
                              className="bg-gray-50 p-3 rounded-md"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{agent.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {agent._id}
                                  </p>
                                </div>
                              </div>
                              {agent.description && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {agent.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Messages Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-700 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-gray-500" />
                        Messages ({selectedSession.messages?.length || 0})
                      </h4>
                      {selectedSession.messages &&
                        selectedSession.messages.length > 25 && (
                          <button
                            className="text-xs text-blue-600 hover:underline"
                            type="button"
                            onClick={() => setShowAllMessages((s) => !s)}
                          >
                            {showAllMessages ? "Show less" : "Show all"}
                          </button>
                        )}
                    </div>
                    {!selectedSession.messages?.length && (
                      <p className="text-xs text-gray-500 italic">
                        No messages yet.
                      </p>
                    )}
                    {selectedSession.messages?.length ? (
                      <ScrollArea className="h-80 w-full rounded-md border border-gray-200 bg-white p-3">
                        <div className="space-y-3 pr-2">
                          {(showAllMessages
                            ? selectedSession.messages
                            : selectedSession.messages.slice(-25)
                          ).map((m) => {
                            const role: string | undefined =
                              (m as any).role || (m as any).author?.role;
                            const content =
                              (m as any).content || (m as any).message || "";
                            const authorName =
                              (m as any).author?.username ||
                              (m as any).author?.name ||
                              (m as any).agent?.name ||
                              role ||
                              "Message";
                            const isAssistant =
                              role === "assistant" ||
                              role === "eden" ||
                              role === "system";
                            return (
                              <div
                                key={
                                  (m as any)._id ||
                                  (m as any).id ||
                                  `${authorName}-${Math.random()}`
                                }
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
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-gray-600">
                                      {authorName}
                                    </span>
                                    {role && (
                                      <span className="text-[10px] uppercase tracking-wide text-gray-400">
                                        {role}
                                      </span>
                                    )}
                                  </div>
                                  <div className="leading-relaxed text-gray-800">
                                    {typeof content === "string"
                                      ? content
                                      : JSON.stringify(content)}
                                  </div>
                                  {(m as any).createdAt && (
                                    <div className="mt-1 text-[10px] text-gray-400">
                                      {new Date(
                                        (m as any).createdAt
                                      ).toLocaleTimeString()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {selectedSession.messages.length > 25 &&
                            !showAllMessages && (
                              <div className="text-center text-[11px] text-gray-500">
                                Showing last 25 of{" "}
                                {selectedSession.messages.length} messages
                              </div>
                            )}
                        </div>
                      </ScrollArea>
                    ) : null}
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setSelectedSession(null)}
                    className="w-full rounded-md"
                  >
                    Close Details
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Eye className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>Select a session to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
