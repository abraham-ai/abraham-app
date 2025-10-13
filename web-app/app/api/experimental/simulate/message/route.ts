import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { AbrahamAbi } from "@/lib/abis/experimental/Abraham";
import { PinataSDK } from "pinata-web3";
import fetch from "node-fetch";

/* same env + helpers as above (DRY them if you like) */
const {
  NEXT_PUBLIC_RPC_URL: RPC_URL,
  PRIVATE_KEY,
  NEXT_PUBLIC_ABRAHAM_ADDRESS: CONTRACT,
  PINATA_JWT,
} = process.env;

const provider = new ethers.JsonRpcProvider(RPC_URL!);
const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);
const contract = new ethers.Contract(CONTRACT!, AbrahamAbi, wallet);
const pinata = new PinataSDK({ pinataJwt: PINATA_JWT! });

async function fetchBytes(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}
async function uploadToPinata(imgUrl: string, content: string) {
  const imgBuf = await fetchBytes(imgUrl);
  const imgFile = new File([imgBuf], "update.png", { type: "image/png" });
  const imgUp = await pinata.upload.file(imgFile);
  const imgIpfs = `ipfs://${imgUp.IpfsHash}`;

  const meta = { name: "Abraham Update", description: content, image: imgIpfs };
  const metaUp = await pinata.upload.json(meta);
  return `ipfs://${metaUp.IpfsHash}`;
}

/*──────────────────── POST /message ───────────────────────
  Body: { sessionId: string|number, imageUrl: string, content: string }
────────────────────────────────────────────────────────────*/
export async function POST(req: NextRequest) {
  try {
    // const { sessionId, imageUrl, content } = await req.json();
    // if (!sessionId || !imageUrl || !content)
    //   return NextResponse.json(
    //     { error: "sessionId, imageUrl, content required" },
    //     { status: 400 }
    //   );

    // //const metaUri = await uploadToPinata(imageUrl, content);

    // const tx = await contract.abrahamUpdate(
    //   BigInt(sessionId),
    //   content,
    //   imageUrl
    // );
    // const receipt = await tx.wait();

    // return NextResponse.json(
    //   { txHash: receipt.transactionHash, sessionId, metadataUri: imageUrl },
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
