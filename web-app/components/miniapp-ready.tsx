"use client";

import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/context/auth-context";

type Props = {
  disableNativeGestures?: boolean;
};

export default function MiniAppReady({ disableNativeGestures = false }: Props) {
  const { ready: privyReady } = usePrivy();
  const { loadingAuth } = useAuth();
  const calledRef = useRef(false);

  useEffect(() => {
    if (!privyReady || loadingAuth || calledRef.current) return;
    calledRef.current = true;

    let raf = 0;
    raf = requestAnimationFrame(() => {
      import("@farcaster/miniapp-sdk")
        .then(async (mod) => {
          try {
            await mod.sdk.actions.ready({ disableNativeGestures });
          } catch {
            // no-op: outside miniapp or SDK unavailable
          }
        })
        .catch(() => {
          // no-op: SDK not present
        });
    });
    return () => cancelAnimationFrame(raf);
  }, [privyReady, loadingAuth, disableNativeGestures]);

  return null;
}
