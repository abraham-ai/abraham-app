import { CHAIN_NAMESPACES, IAdapter, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { Web3Auth, Web3AuthOptions } from "@web3auth/modal";
import { getDefaultExternalAdapters } from "@web3auth/default-evm-adapter"; // Import default external adapters

const clientId =
  "BN4xtlFarFBC8IfJuRxssGkBnUCR9Hn3P_3JuxnhVZkZQ6L74ahm2GhMCls0YRepY1KkgXr-dbLcHAEBE_GSvbE"; // Replace with your Web3Auth client ID

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0x14a34", //Base Sepolia Testnet Chain ID
  rpcTarget: "https://rpc.ankr.com/base_sepolia", // Public RPC endpoint for Sepolia Testnet
  displayName: "Base Sepolia Testnet",
  blockExplorerUrl: "https://sepolia.basescan.org",
  ticker: "ETH",
  tickerName: "ETH",
  logo: "https://github.com/base-org/brand-kit/blob/main/logo/symbol/Base_Symbol_Blue.svg",
};

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig },
});

export const web3AuthOptions: Web3AuthOptions = {
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET, // Use Sapphire DevNet
  privateKeyProvider,
};

// Initialize Web3Auth instance
export const web3auth = new Web3Auth(web3AuthOptions);

// Function to configure all default external adapters (excluding WalletConnect)
export const configureWeb3AuthAdapters = async () => {
  // Get the external adapters (e.g., MetaMask, WalletConnect)
  const adapters = await getDefaultExternalAdapters({
    options: web3AuthOptions,
  });

  // Exclude WalletConnect by filtering the adapters since we do not currenly have a WalletConnect project Id
  const filteredAdapters = adapters.filter(
    (adapter) => adapter.name !== "wallet-connect-v2"
  );

  // Add each filtered adapter to Web3Auth instance
  filteredAdapters.forEach((adapter: IAdapter<unknown>) => {
    web3auth.configureAdapter(adapter);
    //console.log(`Configured adapter: ${adapter.name}`);
  });
};
