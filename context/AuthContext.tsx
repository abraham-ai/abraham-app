"use client";
import React, { createContext, useState, useContext, useEffect } from "react";
import { IAdapter, IProvider } from "@web3auth/base";
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
  const [idToken, setIdToken] = useState<string | null>(() => null);
  const [loggedIn, setLoggedIn] = useState(!!idToken);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [userInfo, setUserInfo] = useState<any | null>(null);
  const [userAccounts, setUserAccounts] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);

  //use effect when idToken changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("idToken");
      setIdToken(token);
    }
  }, []);

  useEffect(() => {
    // Initialize Web3Auth and check login status
    const initWeb3Auth = async () => {
      try {
        await web3auth.initModal(); // Initialize the Web3Auth modal
        setProvider(web3auth.provider);

        if (web3auth.connected && idToken) {
          setLoadingAuth(true);
          setLoggedIn(true);
          const userData = await web3auth.getUserInfo();

          if (web3auth.provider) {
            console.log("Provider is initialized:", web3auth.provider);

            const storedAccounts = await localStorage.getItem("userAccounts");

            if (storedAccounts) {
              console.log("Stored accounts:", storedAccounts);
              setUserAccounts(storedAccounts);
            }
            setLoadingAuth(false);
          } else {
            console.log("Provider is not initialized");
          }
          console.log("User data:", userData);
          console.log("User accounts:", userAccounts);
          setUserInfo(userData);
        }
      } catch (error) {
        console.error("Error initializing Web3Auth:", error);
      }
    };

    initWeb3Auth();
  }, [idToken]);

  const login = async () => {
    try {
      setLoadingAuth(true);
      const web3authProvider = await web3auth.connect();
      setProvider(web3authProvider);

      if (web3auth.connected) {
        setLoggedIn(true);
        const userData = await web3auth.getUserInfo();
        if (web3auth.provider) {
          const getUserAccounts = await RPC.getAccounts(web3auth.provider);
          // Set user accounts to local storage
          localStorage.setItem("userAccounts", getUserAccounts);
          setUserAccounts(getUserAccounts);
        }
        console.log("User data:", userData);

        setUserInfo(userData);
        const tokenResponse = await web3auth.authenticateUser();
        setIdToken(tokenResponse.idToken);
        localStorage.setItem("idToken", tokenResponse.idToken); // Persist the token
        setLoadingAuth(false);
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = async () => {
    try {
      setLoadingAuth(true);
      await web3auth.logout();
      setProvider(null);
      setLoggedIn(false);
      setIdToken(null);
      localStorage.removeItem("idToken"); // Clear token on logout
      localStorage.removeItem("userInfo");
      localStorage.removeItem("userAccounts");
      setUserAccounts(null);
      setLoadingAuth(false);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        idToken,
        login,
        logout,
        loggedIn,
        userInfo,
        userAccounts,
        loadingAuth,
        provider,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
