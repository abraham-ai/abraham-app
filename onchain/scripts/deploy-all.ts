// scripts/deploy-all.ts
const hre = require("hardhat");
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config();

const contractOwner = process.env.CONTRACT_OWNER!;
const outDir = process.env.ADDRESS_OUT_DIR || "deployments";
const outFile = process.env.ADDRESS_OUT_FILE || "addresses.json";
const CONFIRMATIONS = Number(process.env.CONFIRMATIONS || 2);
const MAX_FEE_GWEI = Number(process.env.MAX_FEE_GWEI || 100);
const MAX_PRIORITY_GWEI = Number(process.env.MAX_PRIORITY_GWEI || 2);

function gwei(x: number) {
  return hre.ethers.parseUnits(String(x), "gwei");
}
const feeOverrides = {
  maxFeePerGas: gwei(MAX_FEE_GWEI),
  maxPriorityFeePerGas: gwei(MAX_PRIORITY_GWEI),
};

async function waitForDeploymentWithConfs(contract: any, label: string) {
  await contract.waitForDeployment(); // waits until mined
  const tx = contract.deploymentTransaction();
  if (tx) {
    const r = await tx.wait(CONFIRMATIONS);
    console.log(`   ↳ ${label} confirmed in block ${r.blockNumber}`);
  }
  return contract;
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

  // 1) Token
  const Token = await hre.ethers.getContractFactory("AbrahamToken", deployer);
  const token = await Token.deploy({ ...feeOverrides });
  await waitForDeploymentWithConfs(token, "AbrahamToken.deploy");
  const tokenAddress = await token.getAddress();
  console.log(`✅ AbrahamToken deployed: ${tokenAddress}`);

  // 2) Staking(token)
  const Staking = await hre.ethers.getContractFactory(
    "AbrahamStaking",
    deployer
  );
  const staking = await Staking.deploy(tokenAddress, { ...feeOverrides });
  await waitForDeploymentWithConfs(staking, "AbrahamStaking.deploy");
  const stakingAddress = await staking.getAddress();
  console.log(`✅ AbrahamStaking deployed: ${stakingAddress}`);

  // 3) Abraham(staking)
  const Abraham = await hre.ethers.getContractFactory("Abraham", deployer);
  const abraham = await Abraham.deploy(stakingAddress, { ...feeOverrides });
  await waitForDeploymentWithConfs(abraham, "Abraham.deploy");
  const abrahamAddress = await abraham.getAddress();
  console.log(`✅ Abraham deployed: ${abrahamAddress}`);

  // 4) Optional ownership transfer (no owner() read)
  if (deployer.address.toLowerCase() !== contractOwner.toLowerCase()) {
    const tx = await abraham.transferOwnership(contractOwner, {
      ...feeOverrides,
    });
    const r = await tx.wait(CONFIRMATIONS);
    console.log(`🎉 Ownership transferred in block ${r.blockNumber}\n`);
  } else {
    console.log("ℹ️ Deployer is already the desired owner.\n");
  }

  // 5) Write addresses
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
  if (!fs.existsSync(outPath)) fs.mkdirSync(outPath, { recursive: true });
  const filePath = path.join(outPath, outFile);
  fs.writeFileSync(filePath, JSON.stringify(out, null, 2));
  console.log(`📝 Addresses saved to ${filePath}\n`);
}

main().catch((err: any) => {
  console.error("Error deploying contracts:", err);
  process.exitCode = 1;
});
