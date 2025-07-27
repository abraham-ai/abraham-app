// scripts/deploy-paypatch.ts
const hre = require("hardhat");
import * as dotenv from "dotenv";
dotenv.config();

const contractOwner = process.env.CONTRACT_OWNER; // wallet that *should* own the doc
const initialText = process.env.INITIAL_TEXT || "Hello, System Prompt!";

async function main() {
  if (!contractOwner) throw new Error("CONTRACT_OWNER not set in .env");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`🚀  Deploying SystemPromptPayPatch from: ${deployer.address}`);

  /* 1️⃣ deploy – deployer becomes the on‑chain owner */
  const Factory = await hre.ethers.getContractFactory("SystemPromptPayPatch");
  const doc = await Factory.deploy(initialText);
  await doc.waitForDeployment();
  console.log(
    `✅  SystemPromptPayPatch deployed at: ${await doc.getAddress()}`
  );

  /* 2️⃣ ownership notice */
  if (deployer.address.toLowerCase() !== contractOwner.toLowerCase()) {
    console.warn(
      "⚠️  Deployer ≠ CONTRACT_OWNER. " +
        "This contract has an *immutable* owner – redeploy from the desired owner key " +
        "or extend the contract with a transferOwnership() function."
    );
  } else {
    console.log("ℹ️  Deployer is the desired owner; nothing else to do.");
  }
}

main().catch((err: any) => {
  console.error("Error deploying SystemPromptPayPatch:", err);
  process.exitCode = 1;
});
