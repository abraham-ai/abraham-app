"use client";
import { PrivyProvider, PrivyClientConfig } from "@privy-io/react-auth";
import { getPreferredChain, baseSepolia, ethSepolia } from "./chains";

const privyConfig: PrivyClientConfig = {
  embeddedWallets: {
    createOnLogin: "users-without-wallets",
  },
  loginMethods: ["wallet", "email", "google", "discord", "twitter"],
  supportedChains: [ethSepolia, baseSepolia],
  defaultChain: getPreferredChain(),
  appearance: { showWalletLoginFirst: true, theme: "light" },
};

export function AppPrivyProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={privyConfig}
    >
      {children}
    </PrivyProvider>
  );
}
