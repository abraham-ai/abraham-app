// scripts/deploy.ts  (TypeScript / CommonJS mix keeps your original style)
const hre = require("hardhat");
import * as dotenv from "dotenv";
dotenv.config();

const contractOwner = process.env.CONTRACT_OWNER; // desired final owner

async function main() {
  if (!contractOwner) throw new Error("CONTRACT_OWNER not set in .env");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`🚀 Deploying from: ${deployer.address}`);

  // 1️⃣ deploy (deployer is temporary owner)
  const Abraham = await hre.ethers.getContractFactory("Abraham");
  const abraham = await Abraham.deploy();
  await abraham.waitForDeployment();
  console.log(`✅ Abraham deployed at: ${await abraham.getAddress()}`);

  // 2️⃣ hand over ownership if needed
  if (deployer.address.toLowerCase() !== contractOwner.toLowerCase()) {
    console.log(`🔄 Transferring ownership to ${contractOwner} …`);
    const tx = await abraham.transferOwnership(contractOwner);
    await tx.wait();
    console.log("🎉 Ownership transferred.");
  } else {
    console.log("ℹ️ Deployer is already the desired owner.");
  }
}

main().catch((err) => {
  console.error("Error deploying contracts:", err);
  process.exitCode = 1;
});
