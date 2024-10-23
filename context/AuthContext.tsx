"use client";
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { IProvider } from "@web3auth/base";
import { web3auth } from "@/lib/web3AuthConfig";
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
  const [web3AuthInitialized, setWeb3AuthInitialized] = useState(false); // Add initialization state

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
        await web3auth.initModal();
        setProvider(web3auth.provider);
        setWeb3AuthInitialized(true); // Set to true after initialization

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
  }, []);

  const login = async () => {
    setLoadingAuth(true);
    try {
      // Check if Web3Auth is initialized, if not, reinitialize it
      if (!web3AuthInitialized) {
        await web3auth.initModal();
        setWeb3AuthInitialized(true); // Ensure it's marked as initialized
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
    setLoadingAuth(true);
    try {
      await web3auth.logout();
      setProvider(null);
      setLoggedIn(false);
      setIdToken(null);
      localStorage.removeItem("idToken");
      localStorage.removeItem("userInfo");
      localStorage.removeItem("userAccounts");
      setUserAccounts(null);
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoadingAuth(false);
    }
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
