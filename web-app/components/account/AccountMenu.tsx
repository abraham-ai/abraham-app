"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Loader2Icon,
  CoinsIcon,
  WalletIcon,
  ArrowDownToLineIcon,
  CopyIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  http,
  parseEther,
} from "viem";
import { baseSepolia } from "viem/chains";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import RandomPixelAvatar from "@/components/account/RandomPixelAvatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { showErrorToast, showSuccessToast } from "@/lib/error-utils";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(baseSepolia.rpcUrls.default.http[0]),
});

function short(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    showSuccessToast("Copied", "Address copied to clipboard");
  } catch {
    showErrorToast(new Error("copy"), "Failed to copy");
  }
}

export default function AccountMenu() {
  const { login, logout, loggedIn, loadingAuth, authState } = useAuth();
  const { user } = usePrivy();
  const { wallets } = useWallets();

  const eoaWallet = wallets[0]; // primary signer (embedded or external)
  const eoaAddress = useMemo(
    () => eoaWallet?.address as `0x${string}` | undefined,
    [eoaWallet]
  );

  // Smart wallet address from Privy linked accounts
  const smartWalletAddress = useMemo(
    () =>
      (user?.linkedAccounts as any[])?.find((a) => a?.type === "smart_wallet")
        ?.address as `0x${string}` | undefined,
    [user]
  );

  // Make sure we’re on Base Sepolia for wallet UIs
  useEffect(() => {
    const ensureChain = async () => {
      if (!eoaWallet) return;
      try {
        if (eoaWallet.chainId !== `eip155:${baseSepolia.id}`) {
          await eoaWallet.switchChain(baseSepolia.id);
        }
      } catch (err) {
        console.warn("Chain switch rejected/failed", err);
      }
    };
    ensureChain();
  }, [eoaWallet]);

  // Balances
  const [smartEth, setSmartEth] = useState<string | null>(null);
  const [eoaEth, setEoaEth] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refreshBalances = useCallback(async () => {
    setRefreshing(true);
    try {
      if (smartWalletAddress) {
        const b = await publicClient.getBalance({
          address: smartWalletAddress,
        });
        setSmartEth(formatEther(b));
      } else {
        setSmartEth(null);
      }
      if (eoaAddress) {
        const b = await publicClient.getBalance({ address: eoaAddress });
        setEoaEth(formatEther(b));
      } else {
        setEoaEth(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [smartWalletAddress, eoaAddress]);

  useEffect(() => {
    refreshBalances();
    // optional polling every 20s
    const t = setInterval(refreshBalances, 20000);
    return () => clearInterval(t);
  }, [refreshBalances]);

  // Fund smart wallet (EOA -> Smart)
  const [fundOpen, setFundOpen] = useState(false);
  const [amount, setAmount] = useState("0.01");
  const [funding, setFunding] = useState(false);

  const doFund = async () => {
    if (!eoaWallet) {
      showErrorToast(new Error("no wallet"), "No EOA wallet available");
      return;
    }
    if (!smartWalletAddress) {
      showErrorToast(new Error("no smart"), "No smart wallet address");
      return;
    }
    let value: bigint;
    try {
      value = parseEther(amount || "0");
      if (value <= BigInt(0)) throw new Error("Amount must be > 0");
    } catch (e) {
      showErrorToast(e as Error, "Invalid amount");
      return;
    }

    setFunding(true);
    try {
      const provider = await eoaWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        chain: baseSepolia,
        transport: custom(provider),
      });

      if (!eoaAddress) {
        throw new Error("EOA address is not available");
      }

      const hash = await walletClient.sendTransaction({
        to: smartWalletAddress,
        value,
        chain: baseSepolia,
        account: eoaAddress,
      });

      showSuccessToast("Funding sent", "Waiting for confirmation…");
      await publicClient.waitForTransactionReceipt({ hash });
      showSuccessToast("Smart wallet funded", "Funds are available.");
      setFundOpen(false);
      setAmount("0.01");
      refreshBalances();
    } catch (e) {
      showErrorToast(e as Error, "Funding failed");
    } finally {
      setFunding(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="m-3 flex justify-center">
        <Loader2Icon className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="m-3">
      {loggedIn ? (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="cursor-pointer">
                {authState.profileImage ? (
                  <Image
                    src={authState.profileImage}
                    alt="profile"
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <RandomPixelAvatar
                    username={authState.username ?? "anon"}
                    size={32}
                  />
                )}
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>
                <p className="truncate">{authState.username}</p>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              {/* Smart Wallet block */}
              <div className="px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <WalletIcon className="w-4 h-4" />
                  <span>Smart Wallet (Base Sepolia)</span>
                </div>
                <div className="mt-1 text-xs text-gray-600 break-all">
                  {smartWalletAddress ? (
                    <>
                      <code>{smartWalletAddress}</code>
                      <button
                        onClick={() =>
                          smartWalletAddress && copy(smartWalletAddress)
                        }
                        className="ml-2 inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
                        title="Copy address"
                      >
                        <CopyIcon className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <span>Not provisioned yet</span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <CoinsIcon className="w-4 h-4" />
                    <span>
                      {smartEth !== null
                        ? `${Number(smartEth).toFixed(5)} ETH`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshBalances}
                      disabled={refreshing}
                    >
                      {refreshing ? (
                        <Loader2Icon className="w-4 h-4 animate-spin" />
                      ) : (
                        "Refresh"
                      )}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setFundOpen(true)}
                      disabled={!smartWalletAddress || !eoaAddress}
                    >
                      <ArrowDownToLineIcon className="w-4 h-4 mr-1" />
                      Fund
                    </Button>
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator />

              {/* EOA (signer) block */}
              <div className="px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <WalletIcon className="w-4 h-4" />
                  <span>Signer (EOA)</span>
                </div>
                <div className="mt-1 text-xs text-gray-600 break-all">
                  {eoaAddress ? (
                    <>
                      <code>{eoaAddress}</code>
                      <button
                        onClick={() => eoaAddress && copy(eoaAddress)}
                        className="ml-2 inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
                        title="Copy address"
                      >
                        <CopyIcon className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <span>Unavailable</span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <CoinsIcon className="w-4 h-4" />
                  <span>
                    {eoaEth !== null ? `${Number(eoaEth).toFixed(5)} ETH` : "—"}
                  </span>
                </div>
              </div>

              <DropdownMenuSeparator />

              {/* Quick faucet links for Base Sepolia */}
              <div className="px-3 py-2 text-xs text-gray-600">
                <div className="mb-1 font-medium">Get testnet ETH</div>
                <div className="flex flex-col gap-1">
                  <a
                    className="inline-flex items-center gap-1 hover:underline"
                    href="https://docs.base.org/tools/network-faucets"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Base docs faucet list{" "}
                    <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                  <a
                    className="inline-flex items-center gap-1 hover:underline"
                    href="https://faucets.chain.link/base-sepolia"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Chainlink faucet (0.5 ETH){" "}
                    <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                  <a
                    className="inline-flex items-center gap-1 hover:underline"
                    href="https://www.alchemy.com/faucets/base-sepolia"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Alchemy faucet <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem asChild>
                <Link href="/profile">Profile</Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* FUND DIALOG */}
          <Dialog open={fundOpen} onOpenChange={setFundOpen}>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Fund Smart Wallet</DialogTitle>
                <DialogDescription>
                  Send ETH from your signer (EOA) to your smart wallet on Base
                  Sepolia.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <div className="text-sm">
                  <div className="text-gray-600">From (EOA)</div>
                  <div className="font-mono text-xs break-all">
                    {eoaAddress ?? "—"}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-gray-600">To (Smart Wallet)</div>
                  <div className="font-mono text-xs break-all">
                    {smartWalletAddress ?? "—"}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-gray-600 mb-1">Amount (ETH)</div>
                  <Input
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.01"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setFundOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={doFund}
                  disabled={funding || !smartWalletAddress || !eoaAddress}
                >
                  {funding && (
                    <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                  )}
                  {funding ? "Sending…" : "Send"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Button onClick={login} className="px-8 rounded-lg">
          Sign&nbsp;in
        </Button>
      )}
    </div>
  );
}
