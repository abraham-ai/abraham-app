import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config();

// Basic network config (optional convenience)
const NETWORK_CONFIG: Record<
  string,
  { stakingPool: string; multisig?: string }
> = {
  sepolia: {
    stakingPool: "0x31eC8e59C11bd78f1057Dd9123b43C708Be76856",
  },
  "base-sepolia": {
    stakingPool: "0x31eC8e59C11bd78f1057Dd9123b43C708Be76856",
  },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || "unknown";

  console.log(`\n🚀 Deploying AbrahamCuration`);
  console.log(`📡 Network: ${networkName} (chainId: ${network.chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(
    `💰 Balance: ${ethers.formatEther(
      await ethers.provider.getBalance(deployer.address)
    )} ETH\n`
  );

  // Resolve staking pool
  const config = NETWORK_CONFIG[networkName];
  const STAKING_POOL = process.env.STAKING_POOL_ADDRESS || config?.stakingPool;
  if (!STAKING_POOL)
    throw new Error(`Missing staking pool address for ${networkName}`);

  console.log(`📋 Configuration:`);
  console.log(`   Staking Pool: ${STAKING_POOL}\n`);

  // Deploy contract
  console.log(`🔨 Deploying AbrahamCuration...`);
  const AbrahamCuration = await ethers.getContractFactory("AbrahamCuration");
  const abrahamCuration = await AbrahamCuration.deploy(STAKING_POOL);
  await abrahamCuration.waitForDeployment();

  const contractAddress = await abrahamCuration.getAddress();
  console.log(`✅ AbrahamCuration deployed at: ${contractAddress}\n`);

  // Optionally transfer ownership
  const OWNER_ADDRESS = process.env.CONTRACT_OWNER || deployer.address;
  if (OWNER_ADDRESS.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log(`👑 Transferring ownership to ${OWNER_ADDRESS}...`);
    const tx = await abrahamCuration.transferOwnership(OWNER_ADDRESS);
    await tx.wait();
    console.log(`   ✓ Ownership transferred\n`);
  }

  // Save deployment metadata
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir))
    fs.mkdirSync(deploymentsDir, { recursive: true });

  const file = path.join(
    deploymentsDir,
    `${networkName}-abraham-curation.json`
  );
  const info = {
    contract: "AbrahamCuration",
    address: contractAddress,
    stakingPool: STAKING_POOL,
    owner: OWNER_ADDRESS,
    network: networkName,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(info, null, 2));
  console.log(`📝 Deployment info saved to ${file}\n`);

  // Verification tip
  console.log(`🔍 Verify on explorer:\n`);
  console.log(
    `npx hardhat verify --network ${networkName} ${contractAddress} "${STAKING_POOL}"`
  );
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
