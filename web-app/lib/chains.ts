import { sepolia as viemSepolia } from "viem/chains";
import { Chain } from "viem";

// Ethereum Sepolia (viem's preset)
export const ethSepolia = {
  ...viemSepolia,
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_ETH_RPC_URL ||
          process.env.NEXT_PUBLIC_RPC_URL ||
          "",
      ],
    },
    public: {
      http: [
        process.env.NEXT_PUBLIC_ETH_RPC_URL ||
          process.env.NEXT_PUBLIC_RPC_URL ||
          "",
      ],
    },
  },
} as const satisfies Chain;

// Base Sepolia custom chain
export const baseSepolia = {
  id: 84_532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Base Sepolia ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_BASE_RPC_URL ||
          process.env.NEXT_PUBLIC_RPC_URL ||
          "",
      ],
    },
    public: {
      http: [
        process.env.NEXT_PUBLIC_BASE_RPC_URL ||
          process.env.NEXT_PUBLIC_RPC_URL ||
          "",
      ],
    },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
} as const satisfies Chain;

export type PreferredChainName = "eth" | "base";

export function getPreferredChainName(): PreferredChainName {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(
      "preferredChain"
    ) as PreferredChainName | null;
    if (stored === "base" || stored === "eth") return stored;
  }
  const env = (process.env.NEXT_PUBLIC_DEFAULT_CHAIN || "eth").toLowerCase();
  return env === "base" ? "base" : "eth";
}

export function setPreferredChainName(name: PreferredChainName) {
  try {
    if (typeof window !== "undefined")
      window.localStorage.setItem("preferredChain", name);
  } catch {}
}

export function getPreferredChain(): Chain {
  return getPreferredChainName() === "base" ? baseSepolia : ethSepolia;
}
