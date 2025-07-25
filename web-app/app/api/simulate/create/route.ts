import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { PinataSDK } from "pinata-web3";
import { randomUUID } from "crypto";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import fetch from "node-fetch";

/*──────────────── env vars ─────────────────*/
const {
  NEXT_PUBLIC_RPC_URL: RPC_URL,
  PRIVATE_KEY,
  NEXT_PUBLIC_ABRAHAM_ADDRESS: CONTRACT,
  PINATA_JWT,
} = process.env;

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT || !PINATA_JWT) {
  throw new Error("Missing env vars for creation endpoint");
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);
const abraham = new ethers.Contract(CONTRACT!, AbrahamAbi, wallet);
const pinata = new PinataSDK({ pinataJwt: PINATA_JWT! });

/*──────── optional helper: upload to IPFS ───────*/
async function fetchBytes(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
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

/*──────── POST /api/creations ─────────────*/
export async function POST(req: NextRequest) {
  try {
    const { imageUrl, content } = await req.json();

    if (!imageUrl || !content) {
      return NextResponse.json(
        { error: "imageUrl & content required" },
        { status: 400 }
      );
    }

    // const mediaUri = await uploadToPinata(imageUrl, content); // enable if desired
    const mediaUri = imageUrl;

    /* fresh UUIDs */
    const sessionId = randomUUID();
    const firstMessageId = randomUUID();

    /* send tx */
    const tx = await abraham.createSession(
      sessionId,
      firstMessageId,
      content,
      mediaUri
    );
    const rcpt = await tx.wait();

    return NextResponse.json(
      {
        txHash: rcpt.transactionHash,
        sessionId,
        firstMessageId,
        imageUrl: mediaUri,
      },
      { status: 200 }
    );
    // return NextResponse.json(
    //   {
    //     error:
    //       "This endpoint is currently disabled. Please uncomment the code in the handler.",
    //   },
    //   { status: 503 }
    // );
  } catch (e: any) {
    console.error("createSession api:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
