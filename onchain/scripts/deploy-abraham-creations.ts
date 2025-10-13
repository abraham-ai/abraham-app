// scripts/deploy-abraham-creations.ts
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config();

// Network-specific configurations
const NETWORK_CONFIG: Record<
  string,
  {
    spiritToken: string;
    stakingPoolBeacon: string;
    edenFactory: string;
    multisig: string;
  }
> = {
  sepolia: {
    spiritToken: "0x073C97Ca5Ed16f2097A44A206193a97c0aE327A4",
    stakingPoolBeacon: "0x5a0AE4D855Fb94709032a86c0af3a42cEC855fA2",
    edenFactory: "0x64B6A29edC6cacF9568332E302D293A562c2fb8F",
    multisig: "0x3139DB2845810C4DE0727A5D5Aa24146C086eE1A",
  },
  "base-sepolia": {
    spiritToken: "0x9F44c21412B78595BAF5DB1375ee009f70fb142a",
    stakingPoolBeacon: "0x53012961598f057263Bfabf4BEb3a4fB0dd007Bb",
    edenFactory: "0x6F8B2FC5f02F6904466A86C2BE49dE48b6a727a6",
    multisig: "0x3139DB2845810C4DE0727A5D5Aa24146C086eE1A",
  },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const networkName = process.env.HARDHAT_NETWORK || "unknown";

  console.log(`\n🚀 Deploying AbrahamCreations`);
  console.log(`📡 Network: ${networkName} (Chain ID: ${network.chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(
    `💰 Balance: ${ethers.formatEther(
      await ethers.provider.getBalance(deployer.address)
    )} ETH\n`
  );

  // Get network config
  const config = NETWORK_CONFIG[networkName];
  if (!config) {
    throw new Error(`No configuration found for network: ${networkName}`);
  }

  // Allow override via environment variables
  const STAKING_POOL_ADDRESS =
    process.env.STAKING_POOL_ADDRESS || config.stakingPoolBeacon;
  const ABRAHAM_TOKEN_ADDRESS =
    process.env.ABRAHAM_TOKEN_ADDRESS || config.spiritToken;
  const OWNER_ADDRESS = process.env.CONTRACT_OWNER || deployer.address;

  console.log(`📋 Configuration:`);
  console.log(`   Spirit Token (Abraham Token): ${ABRAHAM_TOKEN_ADDRESS}`);
  console.log(`   Staking Pool: ${STAKING_POOL_ADDRESS}`);
  console.log(`   Eden Factory: ${config.edenFactory}`);
  console.log(`   Final Owner: ${OWNER_ADDRESS}\n`);

  // Important note about staking pool
  console.log(
    `⚠️  NOTE: The Staking Pool address above is a BEACON (template).`
  );
  console.log(`   Actual StakingPool instances are created by EdenFactory.`);
  console.log(
    `   You may need to find the specific instance for your CHILD token.\n`
  );

  // Deploy AbrahamCreations
  console.log(`🔨 Deploying AbrahamCreations contract...`);
  const AbrahamCreations = await ethers.getContractFactory("AbrahamCreations");
  const abrahamCreations = await AbrahamCreations.deploy(
    STAKING_POOL_ADDRESS,
    ABRAHAM_TOKEN_ADDRESS
  );
  await abrahamCreations.waitForDeployment();

  const contractAddress = await abrahamCreations.getAddress();
  console.log(`✅ AbrahamCreations deployed at: ${contractAddress}\n`);

  // Configure requirements (blessing = 10 tokens, commandment = 20 tokens)
  console.log(`⚙️  Configuring requirements...`);
  const tx1 = await abrahamCreations.setRequirements(
    ethers.parseEther("10"), // blessingRequirement
    ethers.parseEther("20") // commandmentRequirement
  );
  await tx1.wait();
  console.log(`   ✓ Blessing requirement: 10 tokens`);
  console.log(`   ✓ Commandment requirement: 20 tokens\n`);

  // Configure tier table
  console.log(`⚙️  Configuring tier system...`);
  const tiers = [
    {
      minStake: 0n,
      maxBlessingsPerDay: 1,
      maxCommandmentsPerDay: 0,
    },
    {
      minStake: ethers.parseEther("100"),
      maxBlessingsPerDay: 5,
      maxCommandmentsPerDay: 2,
    },
    {
      minStake: ethers.parseEther("1000"),
      maxBlessingsPerDay: 10,
      maxCommandmentsPerDay: 5,
    },
    {
      minStake: ethers.parseEther("10000"),
      maxBlessingsPerDay: 20,
      maxCommandmentsPerDay: 10,
    },
  ];

  const tx2 = await abrahamCreations.setTiers(tiers);
  await tx2.wait();
  console.log(`   ✓ ${tiers.length} tiers configured\n`);

  // Transfer ownership if needed
  if (OWNER_ADDRESS.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log(`👑 Transferring ownership to ${OWNER_ADDRESS}...`);
    const tx = await abrahamCreations.transferOwnership(OWNER_ADDRESS);
    await tx.wait();
    console.log(`   ✓ Ownership transferred\n`);
  }

  // Save deployment info
  const deploymentInfo = {
    network: networkName,
    chainId: network.chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      abrahamCreations: contractAddress,
      stakingPool: STAKING_POOL_ADDRESS,
      abrahamToken: ABRAHAM_TOKEN_ADDRESS,
      edenFactory: config.edenFactory,
    },
    owner: OWNER_ADDRESS,
    config: {
      blessingRequirement: "10",
      commandmentRequirement: "20",
      tiers: tiers.map((t) => ({
        minStake: ethers.formatEther(t.minStake),
        maxBlessingsPerDay: t.maxBlessingsPerDay,
        maxCommandmentsPerDay: t.maxCommandmentsPerDay,
      })),
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = path.join(
    deploymentsDir,
    `${networkName}-${Date.now()}.json`
  );
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📝 Deployment info saved to: ${filename}\n`);

  // Summary
  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`📋 DEPLOYMENT SUMMARY`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`Network:            ${networkName}`);
  console.log(`AbrahamCreations:   ${contractAddress}`);
  console.log(`Staking Pool:       ${STAKING_POOL_ADDRESS}`);
  console.log(`Abraham Token:      ${ABRAHAM_TOKEN_ADDRESS}`);
  console.log(`Eden Factory:       ${config.edenFactory}`);
  console.log(`Owner:              ${OWNER_ADDRESS}`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  // Verification command
  console.log(`🔍 To verify on Etherscan/Basescan, run:`);
  console.log(
    `npx hardhat verify --network ${networkName} ${contractAddress} "${STAKING_POOL_ADDRESS}" "${ABRAHAM_TOKEN_ADDRESS}"\n`
  );
}

main().catch((err) => {
  console.error("❌ Deployment failed:", err);
  process.exit(1);
});
