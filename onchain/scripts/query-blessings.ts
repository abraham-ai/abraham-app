import { ethers, network } from "hardhat";
import { AbrahamCuration__factory } from "../typechain-types";
import fs from "fs";
import path from "path";

type Args = {
  address?: string;
  all?: boolean;
  actor?: string;
  session?: string;
  sessionCount?: string;
  targetCount?: string; // format: sessionId:targetId
  credits?: string; // stakeHolder address
  json?: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {};
  const readVal = (i: number) =>
    i + 1 < argv.length ? argv[i + 1] : undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--address") args.address = readVal(i);
    if (a === "--all") args.all = true;
    if (a === "--actor") args.actor = readVal(i);
    if (a === "--session") args.session = readVal(i);
    if (a === "--sessionCount") args.sessionCount = readVal(i);
    if (a === "--targetCount") args.targetCount = readVal(i);
    if (a === "--credits") args.credits = readVal(i);
    if (a === "--json") args.json = true;
  }
  return args;
}

function getDeployedAddress(netName: string): string | undefined {
  try {
    if (netName === "sepolia") {
      const p = path.resolve(
        __dirname,
        "../deployments/sepolia-abraham-curation.json"
      );
      const raw = fs.readFileSync(p, "utf-8");
      const j = JSON.parse(raw);
      return j.address as string;
    }
    // Add more networks here if needed
  } catch (e) {
    // ignore and fall through
  }
  return undefined;
}

function toISO(ts: bigint): string {
  try {
    return new Date(Number(ts) * 1000).toISOString();
  } catch {
    return ts.toString();
  }
}

function print(data: any, asJson: boolean | undefined) {
  if (asJson) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(data, null, 2));
  } else {
    // eslint-disable-next-line no-console
    console.dir(data, { depth: null, colors: true });
  }
}

async function main() {
  const args = parseArgs();
  const netName = network.name;
  const address = args.address || getDeployedAddress(netName);
  if (!address) {
    throw new Error(
      `Contract address is required. Pass --address <addr> or deploy file must exist for network '${netName}'.`
    );
  }

  const provider = ethers.provider;
  const contract = AbrahamCuration__factory.connect(address, provider);

  const summary: any = { network: netName, address };

  // Always show total blessings
  try {
    const total = await contract.totalBlessings();
    summary.totalBlessings = total.toString();
  } catch (e) {
    summary.totalBlessings = `error: ${(e as Error).message}`;
  }

  // Optional: capacity/credits for a stakeHolder
  if (args.credits) {
    try {
      const [credits, capacity] = await contract.remainingCredits(args.credits);
      summary.credits = {
        stakeHolder: args.credits,
        credits: credits.toString(),
        capacity: capacity.toString(),
      };
    } catch (e) {
      summary.credits = `error: ${(e as Error).message}`;
    }
  }

  // Queries
  const outputs: Record<string, any> = {};

  if (args.all) {
    const list = await contract.getAllBlessings();
    outputs.all = list.map((b: any) => ({
      actor: b.actor,
      stakeHolder: b.stakeHolder,
      sessionId: b.sessionId,
      targetId: b.targetId,
      timestamp: toISO(b.timestamp),
    }));
  }

  if (args.actor) {
    const list = await contract.getBlessingsByActor(args.actor);
    outputs.byActor = list.map((b: any) => ({
      actor: b.actor,
      stakeHolder: b.stakeHolder,
      sessionId: b.sessionId,
      targetId: b.targetId,
      timestamp: toISO(b.timestamp),
    }));
  }

  if (args.session) {
    const list = await contract.getBlessingsBySession(args.session);
    outputs.bySession = list.map((b: any) => ({
      actor: b.actor,
      stakeHolder: b.stakeHolder,
      sessionId: b.sessionId,
      targetId: b.targetId,
      timestamp: toISO(b.timestamp),
    }));
  }

  if (args.sessionCount) {
    const count = await contract.sessionBlessingCount(args.sessionCount);
    outputs.sessionCount = {
      sessionId: args.sessionCount,
      count: count.toString(),
    };
  }

  if (args.targetCount) {
    const [sessionId, targetId] = args.targetCount.split(":");
    if (!sessionId || !targetId) {
      throw new Error("--targetCount expects 'sessionId:targetId'");
    }
    const count = await contract.targetBlessingCount(sessionId, targetId);
    outputs.targetCount = { sessionId, targetId, count: count.toString() };
  }

  // If no specific query flags, show a tiny dashboard (last 5)
  if (
    !args.all &&
    !args.actor &&
    !args.session &&
    !args.sessionCount &&
    !args.targetCount
  ) {
    try {
      const all = await contract.getAllBlessings();
      const last = all.slice(-5).map((b: any) => ({
        actor: b.actor,
        stakeHolder: b.stakeHolder,
        sessionId: b.sessionId,
        targetId: b.targetId,
        timestamp: toISO(b.timestamp),
      }));
      outputs.last5 = last;
    } catch (e) {
      outputs.last5 = `error: ${(e as Error).message}`;
    }
  }

  print({ summary, outputs }, args.json);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
