// pages/api/create_creations.ts
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { AbrahamAbi } from "@/lib/abis/experimental/Abraham"; // Ensure this ABI is correctly defined
import { PinataSDK } from "pinata-web3";
import fetch from "node-fetch";

// Environment variables
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ABRAHAM_CONTRACT = process.env.NEXT_PUBLIC_ABRAHAM_ADDRESS;
const PINATA_JWT = process.env.PINATA_JWT;

// Validate environment variables
if (!PRIVATE_KEY || !ABRAHAM_CONTRACT || !RPC_URL || !PINATA_JWT) {
  throw new Error(
    "Missing required environment variables. Please check your .env file."
  );
}

// Initialize ethers.js
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const abrahamContract = new ethers.Contract(
  ABRAHAM_CONTRACT,
  AbrahamAbi,
  wallet
);

// Initialize Pinata SDK
const pinata = new PinataSDK({
  pinataJwt: PINATA_JWT,
  pinataGateway: "example-gateway.mypinata.cloud",
});

// Helper function to fetch image data from a URL
async function fetchImageData(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image from ${imageUrl}: ${response.statusText}`
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Helper function to upload an image to Pinata
async function uploadFileToPinata(
  fileData: Uint8Array,
  fileName: string,
  mimeType: string
) {
  const file = new File([fileData], fileName, { type: mimeType });
  const upload = await pinata.upload.file(file);
  return `https://gateway.pinata.cloud/ipfs/${upload.IpfsHash}`;
}

// Helper function to upload metadata to Pinata
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
  return `https://gateway.pinata.cloud/ipfs/${upload.IpfsHash}`;
}

// GET handler to process and create on-chain creations
export async function GET() {
  try {
    const metadataIpfsUri =
      "https://gateway.pinata.cloud/ipfs/QmciK6aFR1D58hhhJQCYbczgTvU18Xx7T4U5aSJSdSCesZ";

    //Step 3: Call the Abraham contract's newCreation function
    // const tx = await abrahamContract.newCreation(metadataIpfsUri);
    // const receipt = await tx.wait();
    // const _id = receipt.events[0].args.creationId.toString();

    // const result = {
    //   transactionHash: receipt.transactionHash,
    //   creationId: receipt.events[0].args.creationId.toString(),
    //   metadataUri: metadataIpfsUri,
    // };

    // console.log(`Successfully created on-chain creation ID ${_id}`);

    //Step 5: Return the results
    //return NextResponse.json({ result }, { status: 200 });
    return NextResponse.json("You need to uncomment the code", { status: 200 });
  } catch (error: any) {
    console.error("Error processing GET request:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
