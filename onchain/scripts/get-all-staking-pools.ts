import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia, sepolia } from "viem/chains";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

// EdenFactory addresses
const EDEN_FACTORY_ADDRESSES = {
  sepolia: "0x64B6A29edC6cacF9568332E302D293A562c2fb8F" as `0x${string}`,
  "base-sepolia": "0x64B6A29edC6cacF9568332E302D293A562c2fb8F" as `0x${string}`,
};

// Choose network
const NETWORK = (process.env.NETWORK ||
  "sepolia") as keyof typeof EDEN_FACTORY_ADDRESSES;
const chain = NETWORK === "sepolia" ? sepolia : baseSepolia;
const EDEN_FACTORY = EDEN_FACTORY_ADDRESSES[NETWORK];

const publicClient = createPublicClient({
  chain,
  transport: http(chain.rpcUrls.default.http[0]),
});

interface ChildTokenInfo {
  childToken: string;
  stakingPool: string;
  tokenName?: string;
  tokenSymbol?: string;
  blockNumber: bigint;
  transactionHash: string;
}

async function main() {
  console.log("\n🔍 Scanning for All StakingPool Instances\n");
  console.log("=".repeat(70));
  console.log("Network:", chain.name);
  console.log("EdenFactory:", EDEN_FACTORY);
  console.log("=".repeat(70) + "\n");

  try {
    // Get the current block number
    const currentBlock = await publicClient.getBlockNumber();
    console.log("Current block:", currentBlock.toString());

    // Determine start block
    const startBlock = NETWORK === "sepolia" ? 9382660n : 0n;
    console.log("Scanning from block:", startBlock.toString());
    console.log("\nThis may take a moment...\n");

    let allChildTokens: ChildTokenInfo[] = [];

    // Try different event signatures
    const eventAbis = [
      parseAbi([
        "event ChildCreated(address indexed child, address indexed stakingPool, address indexed creator)",
      ]),
      parseAbi([
        "event ChildCreated(address indexed child, address indexed stakingPool)",
      ]),
      parseAbi([
        "event TokenCreated(address indexed token, address indexed stakingPool)",
      ]),
      parseAbi([
        "event Created(address indexed child, address indexed stakingPool)",
      ]),
    ];

    for (const abi of eventAbis) {
      try {
        const eventName = abi[0].name;
        console.log(`Trying event: ${eventName}...`);

        const logs = await publicClient.getLogs({
          address: EDEN_FACTORY,
          event: abi[0],
          fromBlock: startBlock,
          toBlock: currentBlock,
        });

        if (logs.length > 0) {
          console.log(`✅ Found ${logs.length} events!\n`);

          for (const log of logs) {
            const args = log.args;

            // Handle different event structures
            const childToken =
              (args as any).child || (args as any).token || (args as any)[0];
            const stakingPool = (args as any).stakingPool || (args as any)[1];

            if (childToken && stakingPool) {
              allChildTokens.push({
                childToken: childToken as string,
                stakingPool: stakingPool as string,
                blockNumber: log.blockNumber,
                transactionHash: log.transactionHash,
              });
            }
          }
          break; // Found the right event
        }
      } catch (error: any) {
        // Event signature doesn't match, try next one
        console.log(`   ⚠️  No match: ${error.message.split("\n")[0]}`);
        continue;
      }
    }

    if (allChildTokens.length === 0) {
      console.log("\n⚠️  No events found with standard signatures.");
      console.log("\nTrying alternative approach: checking known tokens...\n");

      // Fallback: check if there are known tokens in .env
      const knownToken = process.env.NEXT_PUBLIC_ABRAHAM_TOKEN_ADDRESS;
      if (knownToken) {
        console.log("Found token in .env, querying directly...");
        try {
          const stakingPool = await publicClient.readContract({
            address: knownToken as `0x${string}`,
            abi: parseAbi(["function stakingPool() view returns (address)"]),
            functionName: "stakingPool",
          });

          allChildTokens.push({
            childToken: knownToken,
            stakingPool: stakingPool as string,
            blockNumber: 0n,
            transactionHash: "0x",
          });
        } catch (error: any) {
          console.log("   ❌ Could not query token:", error.message);
        }
      }

      if (allChildTokens.length === 0) {
        console.log(
          "\nPlease check the EdenFactory contract on block explorer:"
        );
        console.log(
          `${chain.blockExplorers?.default.url}/address/${EDEN_FACTORY}#events\n`
        );
        console.log(
          "Or use the simpler script: get-all-staking-pools-simple.ts"
        );
        process.exit(0);
      }
    }

    // Fetch additional info for each token
    console.log("Fetching token details...\n");

    const tokenAbi = parseAbi([
      "function name() view returns (string)",
      "function symbol() view returns (string)",
    ]);

    const stakingAbi = parseAbi(["function child() view returns (address)"]);

    for (let i = 0; i < allChildTokens.length; i++) {
      const token = allChildTokens[i];

      try {
        // Get token name
        const name = await publicClient.readContract({
          address: token.childToken as `0x${string}`,
          abi: tokenAbi,
          functionName: "name",
        });

        // Get token symbol
        const symbol = await publicClient.readContract({
          address: token.childToken as `0x${string}`,
          abi: tokenAbi,
          functionName: "symbol",
        });

        token.tokenName = name as string;
        token.tokenSymbol = symbol as string;

        // Verify the StakingPool
        const childFromPool = await publicClient.readContract({
          address: token.stakingPool as `0x${string}`,
          abi: stakingAbi,
          functionName: "child",
        });

        const verified =
          (childFromPool as string).toLowerCase() ===
          token.childToken.toLowerCase();

        console.log(`${i + 1}. ${token.tokenName} (${token.tokenSymbol})`);
        console.log(`   Token:        ${token.childToken}`);
        console.log(`   StakingPool:  ${token.stakingPool}`);
        console.log(`   Verified:     ${verified ? "✅" : "❌"}`);
        if (token.blockNumber > 0n) {
          console.log(`   Block:        ${token.blockNumber}`);
          console.log(`   Tx:           ${token.transactionHash}`);
        }
        console.log();
      } catch (error: any) {
        console.log(`${i + 1}. Unknown Token`);
        console.log(`   Token:        ${token.childToken}`);
        console.log(`   StakingPool:  ${token.stakingPool}`);
        if (token.blockNumber > 0n) {
          console.log(`   Block:        ${token.blockNumber}`);
        }
        console.log(`   Error:        ${error.message.split("\n")[0]}`);
        console.log();
      }
    }

    // Save to file
    const outputFile = `staking-pools-${NETWORK}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(allChildTokens, null, 2));

    console.log("=".repeat(70));
    console.log(`\n✨ Found ${allChildTokens.length} StakingPool instance(s)!`);
    console.log(`\n📄 Results saved to: ${outputFile}\n`);

    // Find ABRAHAM token if it exists
    const abrahamToken = process.env.NEXT_PUBLIC_ABRAHAM_TOKEN_ADDRESS;
    if (abrahamToken) {
      const abraham = allChildTokens.find(
        (t) => t.childToken.toLowerCase() === abrahamToken.toLowerCase()
      );

      if (abraham) {
        console.log("🎯 Found your ABRAHAM token!");
        console.log(`\n   Token:       ${abraham.childToken}`);
        console.log(`   StakingPool: ${abraham.stakingPool}`);
        console.log(`\n📝 Add this to your .env:`);
        console.log(
          `   NEXT_PUBLIC_ABRAHAM_STAKING_ADDRESS=${abraham.stakingPool}\n`
        );
      } else {
        console.log("⚠️  Your ABRAHAM token not found in the list.");
        console.log(
          "   It might be on a different network or not created via this factory.\n"
        );
      }
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.error("\nStack:", error.stack);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
