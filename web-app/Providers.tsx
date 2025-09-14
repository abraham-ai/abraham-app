"use client";
import React from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";

type Props = {
  children: React.ReactNode;
};

export default function Providers({ children }: Props) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
      config={{
        // Login methods you want visible in the Privy modal
        loginMethods: ["email", "wallet", "google"],
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],

        // Embedded wallet behavior + UI control
        embeddedWallets: {
          // Ensure an embedded EOA exists (required to control a smart wallet)
          // Per docs: config.embeddedWallets.ethereum.createOnLogin
          ethereum: { createOnLogin: "users-without-wallets" },
          // Hide Privy’s confirm modals globally (you can still override per call)
          showWalletUIs: false,
        },

        appearance: {
          theme: "light",
          accentColor: "#676FFF",
        },
      }}
    >
      {/* Enable Privy Smart Wallets in your React tree */}
      <SmartWalletsProvider>{children}</SmartWalletsProvider>
    </PrivyProvider>
  );
}
