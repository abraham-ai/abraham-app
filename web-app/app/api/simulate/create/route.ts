import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { PinataSDK } from "pinata-web3";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import fetch from "node-fetch";

/*──────────────────── env ────────────────────*/
const {
  NEXT_PUBLIC_RPC_URL: RPC_URL,
  PRIVATE_KEY,
  NEXT_PUBLIC_ABRAHAM_ADDRESS: CONTRACT,
  PINATA_JWT,
} = process.env;

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT || !PINATA_JWT)
  throw new Error("Missing env vars");

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);
const contract = new ethers.Contract(CONTRACT!, AbrahamAbi, wallet);
const pinata = new PinataSDK({ pinataJwt: PINATA_JWT! });

/*──────────────── helper: upload image & metadata ───────────────*/
async function fetchBytes(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadToPinata(imgUrl: string, content: string) {
  /* 1) image → IPFS */
  const imgBuf = await fetchBytes(imgUrl);
  const imgFile = new File([imgBuf], "abraham.png", { type: "image/png" });
  const imgUp = await pinata.upload.file(imgFile);
  const imgIpfs = `ipfs://${imgUp.IpfsHash}`;

  /* 2) metadata → IPFS */
  const meta = {
    name: "Abraham Creation",
    description: content,
    image: imgIpfs,
  };
  const metaUp = await pinata.upload.json(meta);
  return `ipfs://${metaUp.IpfsHash}`;
}

/*──────────────────────── POST /creation ────────────────────────
   Body: { imageUrl: string, content: string }
──────────────────────────────────────────────────────────────────*/
export async function POST(req: NextRequest) {
  try {
    //const { imageUrl, content } = await req.json();
    // if (!imageUrl || !content)
    //   return NextResponse.json(
    //     { error: "imageUrl & content required" },
    //     { status: 400 }
    //   );

    // // const metadataUri = await uploadToPinata(imageUrl, content);

    // const tx = await contract.createSession(content, imageUrl);
    // const receipt = await tx.wait();

    // return NextResponse.json(
    //   {
    //     txHash: receipt.transactionHash,
    //     sessionId: receipt.logs[0]?.topics[1] // SessionCreated indexed id
    //       ? BigInt(receipt.logs[0].topics[1]).toString()
    //       : "unknown",
    //     imageUrl,
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
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
