"use client";

import React, { useEffect, useState } from "react";
import ChatInterface from "@/components/sessions/chat-interface";
import AppBar from "@/components/layout/AppBar";
export default function Chat({ params }: { params: { sessionId: string } }) {
  return (
    <div>
      <AppBar />
      {/* Main Content */}
      <div className="relative flex flex-col items-center justify-center min-h-screen px-6 py-16">
        <ChatInterface sessionId={params.sessionId} />
      </div>
    </div>
  );
}
