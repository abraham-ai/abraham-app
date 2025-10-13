// scripts/deploy.ts
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const STAKING_ADDRESS = process.env.STAKING_ADDRESS; // 0xA8f867fA115f64F9728Fc4fd4Ce959f12442a86E
const OWNER_ADDRESS = process.env.CONTRACT_OWNER; // final owner (can be deployer)

async function main() {
  if (!STAKING_ADDRESS) throw new Error("STAKING_ADDRESS not set");
  const [deployer] = await ethers.getSigners();

  console.log(`🚀 Deploying Abraham from ${deployer.address}`);
  console.log(`🔗 Using staking: ${STAKING_ADDRESS}`);

  const Abraham = await ethers.getContractFactory("Abraham");
  const abraham = await Abraham.deploy(STAKING_ADDRESS);
  await abraham.waitForDeployment();
  const addr = await abraham.getAddress();
  console.log(`✅ Abraham deployed at: ${addr}`);

  // Example defaults
  const tx1 = await abraham.setRequirements(
    ethers.parseEther("10"), // blessingRequirement
    ethers.parseEther("20") // commandmentRequirement
  );
  await tx1.wait();

  // Example tier table (edit to taste)
  const tiers = [
    { minStake: 0n, maxBlessingsPerDay: 1, maxCommandmentsPerDay: 0 },
    {
      minStake: ethers.parseEther("100"),
      maxBlessingsPerDay: 2,
      maxCommandmentsPerDay: 1,
    },
    {
      minStake: ethers.parseEther("1000"),
      maxBlessingsPerDay: 3,
      maxCommandmentsPerDay: 2,
    },
  ];
  const tx2 = await abraham.setTiers(tiers);
  await tx2.wait();
  console.log(`⚙️  Requirements & tiers configured.`);

  if (
    OWNER_ADDRESS &&
    OWNER_ADDRESS.toLowerCase() !== deployer.address.toLowerCase()
  ) {
    console.log(`👑 Transferring ownership to ${OWNER_ADDRESS}...`);
    const tx = await abraham.transferOwnership(OWNER_ADDRESS);
    await tx.wait();
    console.log(`🎉 Ownership transferred.`);
  }
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
