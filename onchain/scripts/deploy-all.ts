// scripts/deploy.ts
const hre = require("hardhat");
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const contractOwner = process.env.CONTRACT_OWNER; // desired final owner
const outDir = process.env.ADDRESS_OUT_DIR || "deployments";
const outFile = process.env.ADDRESS_OUT_FILE || "addresses.json";
const CONFIRMATIONS = Number(process.env.CONFIRMATIONS || 1);

async function waitFor(tx: any, label: string) {
  const r = await tx.wait(CONFIRMATIONS);
  console.log(`   ↳ ${label} confirmed in block ${r.blockNumber}`);
  return r;
}

async function main() {
  if (!contractOwner) throw new Error("CONTRACT_OWNER not set in .env");

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();

  console.log(
    `\n🚀 Deploying to chainId=${network.chainId} (${hre.network.name})`
  );
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`👑 Target Owner: ${contractOwner}\n`);

  /* 1) Deploy AbrahamToken */
  const Token = await hre.ethers.getContractFactory("AbrahamToken", deployer);
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`✅ AbrahamToken deployed: ${tokenAddress}`);

  /* 2) Deploy AbrahamStaking(token) */
  const Staking = await hre.ethers.getContractFactory(
    "AbrahamStaking",
    deployer
  );
  const staking = await Staking.deploy(tokenAddress);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log(`✅ AbrahamStaking deployed: ${stakingAddress}`);

  /* 3) Deploy Abraham(staking) */
  const Abraham = await hre.ethers.getContractFactory("Abraham", deployer);
  const abraham = await Abraham.deploy(stakingAddress);
  await abraham.waitForDeployment();
  const abrahamAddress = await abraham.getAddress();
  console.log(`✅ Abraham deployed: ${abrahamAddress}`);

  /* 4) Optional ownership transfer (skip owner() read to avoid empty result issues) */
  if (deployer.address.toLowerCase() !== contractOwner.toLowerCase()) {
    console.log(`🔄 Transferring Abraham ownership to ${contractOwner} …`);
    const tx = await abraham.transferOwnership(contractOwner);
    await waitFor(tx, "transferOwnership");
    console.log("🎉 Ownership transferred.\n");
  } else {
    console.log("ℹ️ Deployer is already the desired owner.\n");
  }

  /* 5) Persist addresses for dapps/scripts */
  const out = {
    network: { name: hre.network.name, chainId: Number(network.chainId) },
    contracts: {
      AbrahamToken: tokenAddress,
      AbrahamStaking: stakingAddress,
      Abraham: abrahamAddress,
      owner: contractOwner,
      deployer: deployer.address,
    },
    timestamp: new Date().toISOString(),
  };

  const outPath = path.join(process.cwd(), outDir);
  const filePath = path.join(outPath, outFile);
  if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(out, null, 2));
  console.log(`📝 Addresses saved to ${filePath}\n`);
}

main().catch((err: any) => {
  console.error("Error deploying contracts:", err);
  process.exitCode = 1;
});
