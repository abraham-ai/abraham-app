"use client";
import React, { createContext, useContext, useState } from "react";
//import { useMannaTransactions } from "@/hooks/legacy/useMannaTransactions";

interface MannaContextProps {
  balance: string;
  getMannaBalance: () => Promise<void>;
}

const MannaContext = createContext<MannaContextProps | undefined>(undefined);

import { ReactNode } from "react";

interface MannaProviderProps {
  children: ReactNode;
}

export const MannaProvider = ({ children }: MannaProviderProps) => {
  //const { getMannaBalance: fetchBalance } = useMannaTransactions();
  const [balance, setBalance] = useState<string>("0");

  const getMannaBalance = async () => {
    //const newBalance = await fetchBalance();
    // if (typeof newBalance === "string") {
    //   // setBalance(newBalance);
    //   // console;
    // } else {
    //   console.error("fetchBalance did not return a string");
    // }
    console.error("fetchBalance did not return a string");
  };

  return (
    <MannaContext.Provider value={{ balance, getMannaBalance }}>
      {children}
    </MannaContext.Provider>
  );
};

export const useManna = () => {
  const context = useContext(MannaContext);
  if (context === undefined) {
    throw new Error("useManna must be used within a MannaProvider");
  }
  return context;
};
