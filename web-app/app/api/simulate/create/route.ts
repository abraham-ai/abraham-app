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

/*───────────────── POST /api/creations ─────────*/
export async function POST(req: NextRequest) {
  try {
    //   const { imageUrl, content } = await req.json();

    //   if (!imageUrl || !content) {
    //     return NextResponse.json(
    //       { error: "`imageUrl` and `content` are required" },
    //       { status: 400 }
    //     );
    //   }

    //   /* ••• Uncomment to pin the image + metadata on-chain ••• */
    //   // const mediaUri = await uploadToPinata(imageUrl, content);
    //   const mediaUri = imageUrl; // ⬅ simple pass-through (no pinning)

    //   const sessionId = randomUUID();
    //   const firstMessageId = randomUUID();

    //   const tx = await abraham.createSession(
    //     sessionId,
    //     firstMessageId,
    //     content,
    //     mediaUri
    //   );
    //   const rcpt = await tx.wait();

    //   return NextResponse.json(
    //     {
    //       txHash: rcpt.transactionHash,
    //       sessionId,
    //       firstMessageId,
    //       imageUrl: mediaUri,
    //       closed: false, // sessions start OPEN by default
    //     },
    //     { status: 200 }
    //   );
    return NextResponse.json(
      {
        error:
          "This endpoint is currently disabled. Please uncomment the code in the handler.",
      },
      { status: 503 }
    );
  } catch (e: any) {
    console.error("/api/creations POST:", e);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}

/*──────────────── PATCH → close session ────────*/
export async function PATCH(req: NextRequest) {
  try {
    // const { sessionId, imageUrl, content } = await req.json();
    // if (!sessionId || !imageUrl || !content)
    //   return NextResponse.json(
    //     { error: "sessionId, imageUrl & content required" },
    //     { status: 400 }
    //   );

    // // const mediaUri = await uploadToPinata(imageUrl, content); // ⬅ optional
    // const mediaUri = imageUrl;
    // const messageId = randomUUID();

    // /* closed = true toggles the flag */
    // const tx = await abraham.abrahamUpdate(
    //   sessionId,
    //   messageId,
    //   content,
    //   mediaUri,
    //   true // ← CLOSE the session
    // );
    // const rcpt = await tx.wait();

    // return NextResponse.json(
    //   {
    //     txHash: rcpt.transactionHash,
    //     sessionId,
    //     messageId,
    //     closed: true,
    //     imageUrl: mediaUri,
    //   },
    //   { status: 200 }
    // );
    return NextResponse.json(
      {
        error:
          "This endpoint is currently disabled. Please uncomment the code in the handler.",
      },
      { status: 503 }
    );
  } catch (e: any) {
    console.error("/api/creations PATCH:", e);
    return NextResponse.json(
      { error: e?.message ?? "internal error" },
      { status: 500 }
    );
  }
}
