import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { AbrahamAbi } from "@/lib/abis/Abraham";
import { PinataSDK } from "pinata-web3";

const RPC_URL = process.env.RPC_URL || "https://rpc.ankr.com/base_sepolia";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ABRAHAM_CONTRACT = process.env.ABRAHAM_CONTRACT;
const PINATA_JWT = process.env.PINATA_JWT;

if (!PRIVATE_KEY || !ABRAHAM_CONTRACT || !RPC_URL || !PINATA_JWT) {
  throw new Error(
    "Missing required env variables (PRIVATE_KEY, ABRAHAM_CONTRACT, RPC_URL, PINATA_JWT)"
  );
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const abrahamContract = new ethers.Contract(
  ABRAHAM_CONTRACT,
  AbrahamAbi,
  wallet
);

const pinata = new PinataSDK({
  pinataJwt: PINATA_JWT,
  pinataGateway: "example-gateway.mypinata.cloud",
});

async function uploadFileToPinata(
  fileData: Uint8Array,
  fileName: string,
  mimeType: string
) {
  const file = new File([fileData], fileName, { type: mimeType });
  const upload = await pinata.upload.file(file);
  return `ipfs://${upload.IpfsHash}`;
}

async function uploadMetadataToPinata(
  description: string,
  imageIpfsUri: string
) {
  const metadata = {
    name: "Abraham Creation",
    description,
    image: imageIpfsUri,
    attributes: [],
  };

  const upload = await pinata.upload.json(metadata);
  return `ipfs://${upload.IpfsHash}`;
}

export async function POST(request: Request) {
  try {
    const { description, imageBase64 } = await request.json();

    if (!description || !imageBase64) {
      return NextResponse.json(
        { error: "Missing description or imageBase64" },
        { status: 400 }
      );
    }

    const base64Pattern = /^data:(?<mime>image\/[a-zA-Z]+);base64,(?<data>.+)$/;
    const match = imageBase64.match(base64Pattern);
    if (!match || !match.groups) {
      return NextResponse.json(
        { error: "Invalid base64 image format" },
        { status: 400 }
      );
    }

    const mimeType = match.groups.mime;
    const base64Data = match.groups.data;
    const binaryData = Uint8Array.from(atob(base64Data), (c) =>
      c.charCodeAt(0)
    );

    // Upload image to Pinata
    const imageIpfsUri = await uploadFileToPinata(
      binaryData,
      "creation.png",
      mimeType
    );
    // Convert ipfs:// to HTTP gateway URL for releaseCreation
    const imageHttpURL = imageIpfsUri.replace(
      "ipfs://",
      "https://ipfs.io/ipfs/"
    );

    // Upload metadata JSON with description & image
    const metadataIpfsUri = await uploadMetadataToPinata(
      description,
      imageHttpURL
    );
    // Convert ipfs:// to HTTP gateway URL for releaseCreation
    const metadataHttpURL = metadataIpfsUri.replace(
      "ipfs://",
      "https://ipfs.io/ipfs/"
    );

    const tx = await abrahamContract.releaseCreation(metadataHttpURL);
    const receipt = await tx.wait();

    return NextResponse.json(
      {
        message: "Creation on-chain and metadata uploaded",
        image_ipfs: imageHttpURL,
        metadata_ipfs: metadataHttpURL,
        txHash: receipt.transactionHash,
        onchainDetails: receipt.events,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error creating creation on-chain:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
