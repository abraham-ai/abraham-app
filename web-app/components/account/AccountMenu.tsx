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
  PlusIcon,
} from "lucide-react";
import { usePrivy, useWallets, useCreateWallet } from "@privy-io/react-auth";
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

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    showSuccessToast("Copied", "Address copied to clipboard");
  } catch {
    showErrorToast(new Error("copy"), "Failed to copy");
  }
}

// Nicely label a wallet type
function labelForWalletType(t?: string) {
  if (!t) return "Wallet";
  if (t === "privy") return "Embedded Wallet";
  return t.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()); // e.g. metamask -> Metamask
}

export default function AccountMenu() {
  const { login, logout, loggedIn, loadingAuth, authState } = useAuth();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();

  // Partition wallets into external vs. embedded
  const { externalWallets, embeddedWallets } = useMemo(() => {
    const ext = wallets.filter((w: any) => w.walletClientType !== "privy");
    const emb = wallets.filter((w: any) => w.walletClientType === "privy");
    return { externalWallets: ext, embeddedWallets: emb };
  }, [wallets]);

  // Choose a funding wallet: external first (MetaMask, Coinbase, etc.), else fallback to embedded
  const fundingWallet = externalWallets[0] ?? wallets[0] ?? null;
  const fundingWalletAddress = fundingWallet?.address as
    | `0x${string}`
    | undefined;

  // Explicit primary external & embedded addresses for balance display
  const externalEOA = externalWallets[0] ?? null;
  const externalAddress = externalEOA?.address as `0x${string}` | undefined;

  const embeddedEOA = embeddedWallets[0] ?? null;
  const embeddedAddress = embeddedEOA?.address as `0x${string}` | undefined;

  // Smart wallet address from Privy linked accounts
  const smartWalletAddress = useMemo(
    () =>
      (user?.linkedAccounts as any[])?.find((a) => a?.type === "smart_wallet")
        ?.address as `0x${string}` | undefined,
    [user]
  );

  // Ensure the funding wallet is on Base Sepolia (don’t spam chain switches)
  useEffect(() => {
    const ensureChain = async () => {
      if (!fundingWallet) return;
      try {
        if (fundingWallet.chainId !== `eip155:${baseSepolia.id}`) {
          await fundingWallet.switchChain(baseSepolia.id);
        }
      } catch (err) {
        console.warn("Chain switch rejected/failed", err);
      }
    };
    ensureChain();
  }, [fundingWallet]);

  // Balances
  const [smartEth, setSmartEth] = useState<string | null>(null);
  const [externalEth, setExternalEth] = useState<string | null>(null);
  const [embeddedEth, setEmbeddedEth] = useState<string | null>(null);
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
      if (externalAddress) {
        const b = await publicClient.getBalance({ address: externalAddress });
        setExternalEth(formatEther(b));
      } else {
        setExternalEth(null);
      }
      if (embeddedAddress) {
        const b = await publicClient.getBalance({ address: embeddedAddress });
        setEmbeddedEth(formatEther(b));
      } else {
        setEmbeddedEth(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [smartWalletAddress, externalAddress, embeddedAddress]);

  useEffect(() => {
    refreshBalances();
    const t = setInterval(refreshBalances, 20000);
    return () => clearInterval(t);
  }, [refreshBalances]);

  // Fund smart wallet (Funding EOA -> Smart)
  const [fundOpen, setFundOpen] = useState(false);
  const [amount, setAmount] = useState("0.01");
  const [funding, setFunding] = useState(false);

  const doFund = async () => {
    if (!fundingWallet) {
      showErrorToast(
        new Error("no wallet"),
        "No wallet available to fund from"
      );
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
      const provider = await (fundingWallet as any).getEthereumProvider();
      const walletClient = createWalletClient({
        chain: baseSepolia,
        transport: custom(provider),
      });

      if (!fundingWalletAddress) {
        throw new Error("Funding wallet address is undefined");
      }

      const hash = await walletClient.sendTransaction({
        to: smartWalletAddress,
        value,
        chain: baseSepolia,
        account: fundingWalletAddress,
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

  // One-click create for users who don't have a smart wallet yet (provisions embedded signer)
  const [creatingSmart, setCreatingSmart] = useState(false);
  const createSmartWalletNow = async () => {
    setCreatingSmart(true);
    try {
      await createWallet({});
      showSuccessToast(
        "Embedded wallet created",
        "Smart wallet will initialize shortly."
      );
      setTimeout(refreshBalances, 1500);
    } catch (e) {
      showErrorToast(e as Error, "Failed to create embedded wallet");
    } finally {
      setCreatingSmart(false);
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
                    <div className="rounded-md border p-3 bg-gray-50">
                      <p className="text-xs text-gray-700 mb-2">
                        Not provisioned yet — create an embedded signer to
                        enable your smart wallet.
                      </p>
                      <Button
                        size="sm"
                        onClick={createSmartWalletNow}
                        disabled={creatingSmart}
                      >
                        {creatingSmart && (
                          <Loader2Icon className="w-4 h-4 animate-spin mr-2" />
                        )}
                        {creatingSmart ? (
                          "Creating…"
                        ) : (
                          <>
                            <PlusIcon className="w-4 h-4 mr-1" /> Create smart
                            wallet
                          </>
                        )}
                      </Button>
                    </div>
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
                      disabled={!smartWalletAddress || !fundingWallet}
                    >
                      <ArrowDownToLineIcon className="w-4 h-4 mr-1" />
                      Fund
                    </Button>
                  </div>
                </div>

                {/* Funding source tag */}
                {fundingWallet && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Funding source:{" "}
                    {labelForWalletType(
                      (fundingWallet as any).walletClientType
                    )}
                  </p>
                )}
              </div>

              <DropdownMenuSeparator />

              {/* External EOA (MetaMask, etc.) */}
              {externalAddress && (
                <>
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <WalletIcon className="w-4 h-4" />
                      <span>External Wallet (EOA)</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600 break-all">
                      <code>{externalAddress}</code>
                      <button
                        onClick={() => copy(externalAddress)}
                        className="ml-2 inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
                        title="Copy address"
                      >
                        <CopyIcon className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <CoinsIcon className="w-4 h-4" />
                      <span>
                        {externalEth !== null
                          ? `${Number(externalEth).toFixed(5)} ETH`
                          : "—"}
                      </span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}

              {/* Embedded EOA (Privy) */}
              {embeddedAddress && (
                <>
                  <div className="px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <WalletIcon className="w-4 h-4" />
                      <span>Embedded Wallet (EOA)</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600 break-all">
                      <code>{embeddedAddress}</code>
                      <button
                        onClick={() => copy(embeddedAddress)}
                        className="ml-2 inline-flex items-center gap-1 text-gray-500 hover:text-gray-700"
                        title="Copy address"
                      >
                        <CopyIcon className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <CoinsIcon className="w-4 h-4" />
                      <span>
                        {embeddedEth !== null
                          ? `${Number(embeddedEth).toFixed(5)} ETH`
                          : "—"}
                      </span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}

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
                    Chainlink faucet <ExternalLinkIcon className="w-3 h-3" />
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
                  Send ETH from your{" "}
                  <strong>
                    {labelForWalletType(
                      (fundingWallet as any)?.walletClientType
                    )}
                  </strong>{" "}
                  to your smart wallet on Base Sepolia.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <div className="text-sm">
                  <div className="text-gray-600">From (Funding EOA)</div>
                  <div className="font-mono text-xs break-all">
                    {fundingWalletAddress ?? "—"}
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
                  disabled={
                    funding || !smartWalletAddress || !fundingWalletAddress
                  }
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
