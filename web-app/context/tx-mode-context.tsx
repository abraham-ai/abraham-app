"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export type TxMode = "smart" | "wallet";

interface TxModeContextType {
  mode: TxMode;
  setMode: (m: TxMode) => void;
  isMiniApp: boolean;
}

const TxModeContext = createContext<TxModeContextType | undefined>(undefined);

export function TxModeProvider({ children }: { children: React.ReactNode }) {
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [mode, setModeState] = useState<TxMode>("smart");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let mini = false;
      try {
        mini = await sdk.isInMiniApp();
      } catch {
        try {
          const ua =
            typeof navigator !== "undefined" ? navigator.userAgent : "";
          mini = /Warpcast|Farcaster/i.test(ua);
        } catch {}
      }
      if (cancelled) return;
      setIsMiniApp(!!mini);
      const saved = (typeof window !== "undefined" &&
        (localStorage.getItem("txMode") as TxMode | null)) as TxMode | null;
      if (saved === "smart" || saved === "wallet") {
        setModeState(saved);
      } else {
        setModeState(mini ? "wallet" : "smart");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = (m: TxMode) => {
    setModeState(m);
    try {
      localStorage.setItem("txMode", m);
    } catch {}
  };

  const value = useMemo(
    () => ({ mode, setMode, isMiniApp }),
    [mode, isMiniApp]
  );
  return (
    <TxModeContext.Provider value={value}>{children}</TxModeContext.Provider>
  );
}

export function useTxMode() {
  const ctx = useContext(TxModeContext);
  if (!ctx) throw new Error("useTxMode must be used within <TxModeProvider>");
  return ctx;
}
