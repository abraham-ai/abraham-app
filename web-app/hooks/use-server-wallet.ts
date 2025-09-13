"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";

interface ServerWalletState {
  address?: string;
  balance?: string; // in ETH string
  loading: boolean;
  error?: string;
}

export function useServerWallet(pollMs: number = 15000) {
  const { authState, loggedIn } = useAuth();
  const [state, setState] = useState<ServerWalletState>({ loading: false });
  const token = authState.idToken;

  const fetchWallet = useCallback(async () => {
    if (!loggedIn || !token) return;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/wallet", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to get wallet");
      setState((s) => ({ ...s, address: data.wallet.address }));
    } catch (e: any) {
      setState((s) => ({ ...s, error: e.message }));
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [loggedIn, token]);

  const fetchBalance = useCallback(async () => {
    if (!loggedIn || !token) return;
    if (!state.address) return; // need address first
    try {
      const res = await fetch("/api/wallet/balance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to get balance");
      setState((s) => ({ ...s, balance: data.balance }));
    } catch (e: any) {
      setState((s) => ({ ...s, error: e.message }));
    }
  }, [loggedIn, token, state.address]);

  // Initial fetch
  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Fetch balance whenever we have an address
  useEffect(() => {
    if (!state.address) return;
    fetchBalance();
  }, [state.address, fetchBalance]);

  // Poll balance
  useEffect(() => {
    if (!state.address) return;
    const id = setInterval(() => {
      fetchBalance();
    }, pollMs);
    return () => clearInterval(id);
  }, [state.address, fetchBalance, pollMs]);

  return {
    address: state.address,
    balance: state.balance,
    loading: state.loading,
    error: state.error,
    refresh: () => {
      fetchWallet();
      fetchBalance();
    },
  };
}
