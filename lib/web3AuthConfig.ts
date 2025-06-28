import { CHAIN_NAMESPACES, IAdapter, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import {
  AccountAbstractionProvider,
  SafeSmartAccount,
} from "@web3auth/account-abstraction-provider";
import { Web3Auth, Web3AuthOptions } from "@web3auth/modal";
import { getDefaultExternalAdapters } from "@web3auth/default-evm-adapter";

const clientId =
  "BN4xtlFarFBC8IfJuRxssGkBnUCR9Hn3P_3JuxnhVZkZQ6L74ahm2GhMCls0YRepY1KkgXr-dbLcHAEBE_GSvbE";

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0x14a34", // Base Sepolia Testnet Chain ID
  rpcTarget: process.env.NEXT_PUBLIC_RPC_URL || "",
  displayName: "Base Sepolia Testnet",
  blockExplorerUrl: "https://sepolia.basescan.org",
  ticker: "ETH",
  tickerName: "ETH",
  logo: "https://github.com/base-org/brand-kit/blob/main/logo/symbol/Base_Symbol_Blue.svg",
};

// Initialize Account Abstraction Provider
export const accountAbstractionProvider = new AccountAbstractionProvider({
  config: {
    chainConfig,
    smartAccountInit: new SafeSmartAccount(),
    bundlerConfig: {
      url: "/api/accountabstraction/bundler",
    },
    paymasterConfig: {
      url: "/api/accountabstraction/paymaster",
    },
  },
});

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig },
});

export const web3AuthOptions: Web3AuthOptions = {
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET, // Adjust if needed
  chainConfig,
  privateKeyProvider,
  accountAbstractionProvider,
  useAAWithExternalWallet: false, // Ensures AA is used only with embedded wallets
};

// Initialize Web3Auth instance
export const web3auth = new Web3Auth(web3AuthOptions);

// Configure external adapters (excluding WalletConnect)
export const configureWeb3AuthAdapters = async () => {
  const adapters = await getDefaultExternalAdapters({
    options: web3AuthOptions,
  });

  const filteredAdapters = adapters.filter(
    (adapter) => adapter.name !== "wallet-connect-v2"
  );

  filteredAdapters.forEach((adapter: IAdapter<unknown>) => {
    web3auth.configureAdapter(adapter);
  });
};
