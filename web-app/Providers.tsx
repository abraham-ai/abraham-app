"use client";

import React, { useEffect } from "react";
import { PrivyProvider, usePrivy, useCreateWallet } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";

type Props = { children: React.ReactNode };

/**
 * Ensures that users who log in with an external wallet (e.g. MetaMask)
 * also receive an embedded EOA so Privy can provision a Smart Wallet.
 * This primarily helps existing users who connected before "all-users" was set.
 */
function EnsureEmbeddedWalletOnce() {
  const { user, ready, authenticated } = usePrivy();
  const { createWallet } = useCreateWallet();

  useEffect(() => {
    if (!ready || !authenticated || !user) return;

    const linked = (user.linkedAccounts || []) as any[];
    const hasEmbedded = linked.some(
      (a) => a?.type === "wallet" && a?.walletClientType === "privy"
    );

    if (!hasEmbedded) {
      // Silent, one-time creation; errors (e.g., user cancel) are non-fatal.
      createWallet({}).catch(() => void 0);
    }
  }, [ready, authenticated, user, createWallet]);

  return null;
}

export default function Providers({ children }: Props) {
  const isMiniApp =
    typeof window !== "undefined" &&
    /Warpcast|Farcaster/i.test(navigator.userAgent || "");
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
      config={{
        loginMethods: ["email", "wallet", "google", "farcaster"],
        // In a Mini App, bias to Farcaster first for a smoother flow
        appearance: {
          theme: "light",
          accentColor: "#676FFF",
          showWalletLoginFirst: !isMiniApp,
        },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
        embeddedWallets: {
          // In Mini App, avoid auto-creating embedded wallets (host may manage provider)
          ethereum: { createOnLogin: isMiniApp ? "off" : "all-users" },
          // optional: suppress Privy confirmation modals
          //showWalletUIs: false,
        },
      }}
    >
      <SmartWalletsProvider>
        {/* Safety net for users who connected before the setting above; disable in Mini App */}
        {!isMiniApp && <EnsureEmbeddedWalletOnce />}
        {children}
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}
