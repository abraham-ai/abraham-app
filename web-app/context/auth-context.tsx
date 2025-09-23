"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { sdk } from "@farcaster/miniapp-sdk";

declare module "@privy-io/react-auth" {
  interface Google {
    picture?: string;
  }
  interface Discord {
    picture?: string;
  }
  interface Twitter {
    picture?: string;
  }
}

export interface AuthState {
  idToken?: string | null;
  username?: string;
  walletAddress?: string;
  profileImage?: string;
}

interface AuthContextType {
  /* status */
  loadingAuth: boolean;
  loggedIn: boolean;

  /* actions */
  login: () => Promise<void>;
  logout: () => Promise<void>;

  /* data */
  authState: AuthState;
  /** EIP-1193 provider for the user’s primary wallet (if any) */
  eip1193Provider: any | null;
}

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  /* ---------- core privy hooks ---------- */
  const {
    ready: privyReady,
    authenticated,
    user,
    login: privyLogin,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();

  const { wallets, ready: walletsReady } = useWallets();

  /* ---------- derived state ---------- */
  const [authState, setAuthState] = useState<AuthState>({});
  const [eipProvider, setEipProvider] = useState<any | null>(null);
  const [isMiniApp, setIsMiniApp] = useState<boolean | null>(null);
  // Derive loading state: in Mini App, do not block UI on Privy readiness
  const loadingAuth =
    isMiniApp === null
      ? true // brief environment detection
      : isMiniApp
      ? false
      : (!privyReady || !walletsReady) && !authState.idToken;

  // Detect Mini App environment once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mini = await sdk.isInMiniApp();
        if (!cancelled) setIsMiniApp(!!mini);
      } catch {
        if (!cancelled) setIsMiniApp(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- pick a “primary” wallet & provider ---------- */
  useEffect(() => {
    (async () => {
      if (!walletsReady || wallets.length === 0) {
        setEipProvider(null);
        return;
      }
      // Prefer provider whose address matches current authState.walletAddress
      let target = wallets[0];
      try {
        const targetAddr = authState.walletAddress?.toLowerCase();
        if (targetAddr) {
          const found = wallets.find(
            (w: any) => w.address?.toLowerCase?.() === targetAddr
          );
          if (found) target = found as any;
        }
      } catch {}
      const provider = await (target as any).getEthereumProvider();
      setEipProvider(provider);
    })();
  }, [walletsReady, wallets, authState.walletAddress]);

  /* ---------- sync AuthState ---------- */
  useEffect(() => {
    (async () => {
      if (!privyReady) return;

      // If running inside a Farcaster Mini App, prefer Quick Auth
      try {
        const isMini = await sdk.isInMiniApp();
        const suppressed =
          typeof window !== "undefined" &&
          sessionStorage.getItem("miniapp_logout") === "1";
        if (isMini && !suppressed && !authenticated && !authState.idToken) {
          const { token } = await sdk.quickAuth.getToken();
          if (token) {
            setAuthState({ idToken: token });
            localStorage.setItem("idToken", token);
            // Prefer host EIP-1193 provider if available
            try {
              const eth = await sdk.wallet.getEthereumProvider();
              setEipProvider(eth ?? null);
            } catch {}
            return;
          }
        }
      } catch {
        // fall through to Privy
      }

      if (!authenticated || !user) {
        localStorage.removeItem("idToken");
        setAuthState({});
        return;
      }

      /* fetch (or refetch) an access token */
      const token = await getAccessToken();

      const state: AuthState = {
        idToken: token,
        username:
          user.email?.address ??
          user.google?.email ??
          user.discord?.username ??
          user.wallet?.address ??
          user.id.slice(0, 10),
        walletAddress: user.wallet?.address ?? wallets[0]?.address,
        profileImage:
          user.google?.picture ??
          user.discord?.picture ??
          user.twitter?.picture ??
          undefined,
      };

      setAuthState(state);
      localStorage.setItem("idToken", token ?? "");
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privyReady, authenticated, user, wallets]);

  /* ---------- auth actions ---------- */
  const login = async () => {
    try {
      // Inside Mini App: Quick Auth flow
      try {
        const isMini = await sdk.isInMiniApp();
        if (isMini) {
          try {
            sessionStorage.removeItem("miniapp_logout");
          } catch {}
          const { token } = await sdk.quickAuth.getToken();
          if (token) {
            setAuthState({ idToken: token });
            localStorage.setItem("idToken", token);
            return;
          }
        }
      } catch {}

      // Fallback to Privy
      await privyLogin();
    } catch (err) {
      console.error("[Privy] login error", err);
    }
  };

  const logout = async () => {
    try {
      // Attempt to revoke/clear Mini App Quick Auth state
      try {
        const isMini = await sdk.isInMiniApp();
        if (isMini) {
          // No explicit revoke API today; clear our state
          localStorage.removeItem("idToken");
          try {
            sessionStorage.setItem("miniapp_logout", "1");
          } catch {}
          // Immediately reflect logged-out state in Mini App and return
          setAuthState({});
          setEipProvider(null);
          return;
        }
      } catch {}

      // Disconnect all Privy wallets to avoid stale providers
      try {
        for (const w of wallets) {
          try {
            await (w as any).disconnect?.();
          } catch {}
        }
      } catch {}

      // Clear local state
      setAuthState({});
      setEipProvider(null);
      localStorage.removeItem("idToken");

      // Finally, Privy session logout
      await privyLogout();
    } catch (err) {
      console.error("[Privy] logout error", err);
    }
  };

  /* ---------- memoized context ---------- */
  const value: AuthContextType = useMemo(
    () => ({
      loadingAuth,
      loggedIn: authenticated || Boolean(authState.idToken),
      login,
      logout,
      authState,
      eip1193Provider: eipProvider,
    }),
    [loadingAuth, authenticated, authState, eipProvider]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/* -------------------------------------------------------------------------- */
/* Hook                                                                        */
/* -------------------------------------------------------------------------- */

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
