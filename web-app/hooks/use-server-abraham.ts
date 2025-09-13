"use client";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";

interface ActionState {
  loading: boolean;
  error?: string;
  lastTx?: string;
}

export function useServerAbraham() {
  const { authState, loggedIn } = useAuth();
  const token = authState.idToken;
  const [praiseState, setPraise] = useState<ActionState>({ loading: false });
  const [blessState, setBless] = useState<ActionState>({ loading: false });

  const praise = async (sessionId: string, messageId: string) => {
    if (!loggedIn || !token) throw new Error("Not authenticated");
    setPraise({ loading: true });
    try {
      const res = await fetch("/api/praise", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId, messageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Praise failed");
      setPraise({ loading: false, lastTx: data.txHash });
      return data.txHash as string;
    } catch (e: any) {
      setPraise({ loading: false, error: e.message });
      throw e;
    }
  };

  const bless = async (sessionId: string, messageId: string, cid: string) => {
    if (!loggedIn || !token) throw new Error("Not authenticated");
    setBless({ loading: true });
    try {
      const res = await fetch("/api/bless", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId, messageId, cid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Bless failed");
      setBless({ loading: false, lastTx: data.txHash });
      return data.txHash as string;
    } catch (e: any) {
      setBless({ loading: false, error: e.message });
      throw e;
    }
  };

  return {
    praise,
    bless,
    praiseState,
    blessState,
  };
}
