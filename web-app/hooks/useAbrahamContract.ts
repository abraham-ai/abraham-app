import { useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
} from "viem";
import { Chain } from "viem/chains";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import { useAuth } from "@/context/AuthContext";

/* ---------- Base Sepolia ---------- */
const baseSepolia = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { decimals: 18, name: "Base Sepolia ETH", symbol: "ETH" },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL as string] },
    public: { http: [process.env.NEXT_PUBLIC_RPC_URL as string] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
} as const satisfies Chain;

/* ---------- Constants ---------- */
export const CONTRACT_ADDRESS = "0x3667BD9cb464f4492899384c6f73908d6681EC78";
export const PRAISE_PRICE_ETHER = 0.00001;
export const BLESS_PRICE_ETHER = 0.00002;

/* ---------- Hook ---------- */
export function useAbrahamContract() {
  const { provider } = useAuth();
  const [publicClient, setPC] = useState<any>();
  const [walletClient, setWC] = useState<any>();

  useEffect(() => {
    if (!provider) return;
    setPC(
      createPublicClient({ chain: baseSepolia, transport: custom(provider) })
    );
    setWC(
      createWalletClient({ chain: baseSepolia, transport: custom(provider) })
    );
  }, [provider]);

  async function praise(sessionId: number, messageIdx: number) {
    if (!walletClient) throw new Error("wallet not ready");
    const [sender] = await walletClient.getAddresses();
    const hash = await walletClient.writeContract({
      account: sender,
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: AbrahamAbi,
      functionName: "praise",
      args: [sessionId, messageIdx],
      value: parseEther(PRAISE_PRICE_ETHER.toString()),
    });
    await publicClient!.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function bless(sessionId: number, content: string) {
    if (!walletClient) throw new Error("wallet not ready");
    const [sender] = await walletClient.getAddresses();
    const hash = await walletClient.writeContract({
      account: sender,
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: AbrahamAbi,
      functionName: "bless",
      args: [sessionId, content],
      value: parseEther(BLESS_PRICE_ETHER.toString()),
    });
    await publicClient!.waitForTransactionReceipt({ hash });
    return hash;
  }

  return { praise, bless };
}
