import { NextRequest, NextResponse } from "next/server";
import { Wallet, JsonRpcProvider, Contract } from "ethers";
import { PinataSDK } from "pinata-web3";
import { randomUUID } from "crypto";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import fetch from "node-fetch";

/*────────────────── ENV VARS ──────────────────*/
const {
  NEXT_PUBLIC_RPC_URL: RPC_URL,
  PRIVATE_KEY,
  NEXT_PUBLIC_ABRAHAM_ADDRESS: CONTRACT,
  PINATA_JWT,
} = process.env as Record<string, string>;

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT || !PINATA_JWT) {
  throw new Error("Missing env vars for /api/creations route");
}

/*────────────────── ETHERS SETUP ───────────────*/
const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);
const abraham = new Contract(CONTRACT, AbrahamAbi, wallet);

/*────────────────── PINATA (optional) ──────────*/
const pinata = new PinataSDK({ pinataJwt: PINATA_JWT });

async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Upload external PNG + minimal metadata → return ipfs URI */
async function uploadToPinata(imgUrl: string, text: string) {
  const buf = await fetchBytes(imgUrl);
  const file = new File([buf], "cover.png", { type: "image/png" });
  const img = await pinata.upload.file(file);
  const meta = await pinata.upload.json({
    name: "Abraham Creation",
    description: text,
    image: `ipfs://${img.IpfsHash}`,
  });
  return `ipfs://${meta.IpfsHash}`;
}

/*───────────────── POST /api/creations ─────────
  Single **createSession**. Supports:
  - content-only   → uses 3-arg overload
  - media-only     → uses 4-arg (content = "")
  - content+media  → uses 4-arg
  Body:
    {
      imageUrl?: string,      // optional; if present and pin=true we’ll pin to IPFS
      content?: string,       // optional
      pin?: boolean           // optional, default false
    }
───────────────────────────────────────────────*/
export async function POST(req: NextRequest) {
  try {
    const { imageUrl, content, pin = false } = await req.json();

    const contentStr = typeof content === "string" ? content : "";
    let mediaUri = typeof imageUrl === "string" ? imageUrl : "";

    if (pin && mediaUri) {
      mediaUri = await uploadToPinata(mediaUri, contentStr || ""); // optional pin
    }

    if (!contentStr && !mediaUri) {
      return NextResponse.json(
        { error: "At least one of `content` or `imageUrl` is required" },
        { status: 400 }
      );
    }

    const sessionId = randomUUID();
    const firstMessageId = randomUUID();

    let tx;
    if (mediaUri) {
      // use 4-arg overload (content may be "")
      tx = await abraham["createSession(string,string,string,string)"](
        sessionId,
        firstMessageId,
        contentStr,
        mediaUri
      );
    } else {
      // content-only → 3-arg overload requires content non-empty
      tx = await abraham["createSession(string,string,string)"](
        sessionId,
        firstMessageId,
        contentStr
      );
    }

    const rcpt = await tx.wait();

    return NextResponse.json(
      {
        txHash: rcpt?.hash ?? rcpt?.transactionHash,
        sessionId,
        firstMessageId,
        imageUrl: mediaUri,
        content: contentStr,
        closed: false, // sessions start OPEN by default
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("/api/creations POST:", e);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}

/*──────────────── PATCH /api/creations ─────────
  Single **abrahamUpdate**. Supports:
  - content-only   → 3-arg overload (+ bool)
  - media-only     → 4-arg (content = "") (+ bool)
  - content+media  → 4-arg (+ bool)
  Body:
    {
      sessionId: string,
      content?: string,
      imageUrl?: string,
      closed?: boolean, // default true (close); pass false to reopen/keep open
      pin?: boolean
    }
───────────────────────────────────────────────*/
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId: string = body?.sessionId;
    if (!sessionId) {
      return NextResponse.json(
        { error: "`sessionId` is required" },
        { status: 400 }
      );
    }

    const contentStr = typeof body?.content === "string" ? body.content : "";
    const closed: boolean =
      typeof body?.closed === "boolean" ? body.closed : true; // default to close
    let mediaUri = typeof body?.imageUrl === "string" ? body.imageUrl : "";
    const pin = !!body?.pin;

    if (pin && mediaUri) {
      mediaUri = await uploadToPinata(mediaUri, contentStr || "");
    }

    if (!contentStr && !mediaUri) {
      return NextResponse.json(
        { error: "At least one of `content` or `imageUrl` is required" },
        { status: 400 }
      );
    }

    const messageId = randomUUID();

    let tx;
    if (mediaUri) {
      // 5-arg update (content can be empty if media is present)
      tx = await abraham["abrahamUpdate(string,string,string,string,bool)"](
        sessionId,
        messageId,
        contentStr,
        mediaUri,
        closed
      );
    } else {
      // content-only → 4-arg overload requires content non-empty
      tx = await abraham["abrahamUpdate(string,string,string,bool)"](
        sessionId,
        messageId,
        contentStr,
        closed
      );
    }

    const rcpt = await tx.wait();

    return NextResponse.json(
      {
        txHash: rcpt?.hash ?? rcpt?.transactionHash,
        sessionId,
        messageId,
        imageUrl: mediaUri,
        content: contentStr,
        closed,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("/api/creations PATCH:", e);
    return NextResponse.json(
      { error: e?.message ?? "internal error" },
      { status: 500 }
    );
  }
}
