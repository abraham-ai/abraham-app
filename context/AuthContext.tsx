"use client";
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { IProvider } from "@web3auth/base";
import { web3auth, configureWeb3AuthAdapters } from "@/lib/web3AuthConfig";
import RPC from "@/lib/ethersRPC";

// Define the AuthContext type
interface AuthContextType {
  idToken: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  loggedIn: boolean;
  userInfo: any | null;
  userAccounts: any | null;
  loadingAuth: boolean;
  provider: IProvider | null;
}

// Create the AuthContext
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use the AuthContext
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [userInfo, setUserInfo] = useState<any | null>(null);
  const [userAccounts, setUserAccounts] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [web3AuthInitialized, setWeb3AuthInitialized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("idToken");
    const storedAccounts = localStorage.getItem("userAccounts");

    if (token) {
      setIdToken(token);
      setLoggedIn(true);
      setUserAccounts(storedAccounts);
    }

    const initWeb3Auth = async () => {
      try {
        await configureWeb3AuthAdapters(); // Configure adapters
        await web3auth.initModal();
        setProvider(web3auth.provider);
        setWeb3AuthInitialized(true);

        if (web3auth.connected && token) {
          const userData = await web3auth.getUserInfo();
          setUserInfo(userData);
        }
      } catch (error) {
        console.error("Error initializing Web3Auth:", error);
      } finally {
        setLoadingAuth(false);
      }
    };

    if (token) {
      initWeb3Auth();
    } else {
      setLoadingAuth(false);
    }

    const tokenCheckInterval = setInterval(() => {
      if (idToken && isTokenExpired(idToken)) {
        resetAuthState(); // Clear state and storage on token expiry
        logout();
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(tokenCheckInterval);
  }, [idToken]);

  const login = async () => {
    setLoadingAuth(true);
    try {
      if (!web3AuthInitialized) {
        await configureWeb3AuthAdapters();
        await web3auth.initModal();
        setWeb3AuthInitialized(true);
      }

      const web3authProvider = await web3auth.connect();
      setProvider(web3authProvider);

      if (web3auth.provider) {
        const userData = await web3auth.getUserInfo();
        const getUserAccounts = await RPC.getAccounts(web3auth.provider);

        localStorage.setItem("userAccounts", getUserAccounts);
        setUserAccounts(getUserAccounts);
        setUserInfo(userData);

        const tokenResponse = await web3auth.authenticateUser();
        setIdToken(tokenResponse.idToken);
        localStorage.setItem("idToken", tokenResponse.idToken);
        setLoggedIn(true);
      }
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setLoadingAuth(false);
    }
  };

  const logout = async () => {
    if (!web3auth.connected) {
      console.warn("No wallet is connected.");
      resetAuthState();
      return;
    }

    setLoadingAuth(true);
    try {
      await web3auth.logout();
      resetAuthState();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoadingAuth(false);
    }
  };

  const resetAuthState = () => {
    setProvider(null);
    setLoggedIn(false);
    setIdToken(null);
    setUserInfo(null);
    setUserAccounts(null);
    localStorage.removeItem("idToken");
    localStorage.removeItem("userInfo");
    localStorage.removeItem("userAccounts");
  };

  const isTokenExpired = (token: string): boolean => {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expiration = payload.exp * 1000;
    return Date.now() > expiration;
  };

  const authContextValue = useMemo(
    () => ({
      idToken,
      login,
      logout,
      loggedIn,
      userInfo,
      userAccounts,
      loadingAuth,
      provider,
    }),
    [idToken, loggedIn, userInfo, userAccounts, loadingAuth, provider]
  );

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}
