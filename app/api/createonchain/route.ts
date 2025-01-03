// pages/api/create_creations.ts
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { AbrahamAbi } from "@/lib/abis/Abraham"; // Ensure this ABI is correctly defined
import { PinataSDK } from "pinata-web3";
import fetch from "node-fetch";

// Environment variables
const RPC_URL = process.env.RPC_URL || "https://rpc.ankr.com/base_sepolia";
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
  return `ipfs://${upload.IpfsHash}`;
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
  return `ipfs://${upload.IpfsHash}`;
}

// GET handler to process and create on-chain creations
export async function GET() {
  const externalApiUrl =
    "https://edenartlab--abraham2-fastapi-app.modal.run/get_creations";

  try {
    // Step 1: Fetch creations from the external API
    const response = await fetch(externalApiUrl);
    if (!response.ok) {
      throw new Error(`Error fetching creations: ${response.statusText}`);
    }

    const creationsData: any[] = (await response.json()) as any[];

    if (!Array.isArray(creationsData)) {
      throw new Error("Invalid data format received from external API.");
    }

    const results: any[] = [];

    // Step 2: Process each creation
    for (const creation of creationsData) {
      const { _id, creation: creationDetails, result } = creation;

      try {
        const { title, description, visual_aesthetic } = creationDetails;

        // Extract image URL
        const imageUrl = result?.output?.[0]?.url;
        if (!imageUrl) {
          throw new Error(`No image URL found for creation ID ${_id}`);
        }

        // Fetch image data
        const imageData = await fetchImageData(imageUrl);

        // Determine MIME type from the image URL extension
        const mimeMatch = imageUrl.match(/\.(png|jpg|jpeg|gif|svg)$/i);
        const mimeType = mimeMatch
          ? `image/${mimeMatch[1].toLowerCase()}`
          : "application/octet-stream";

        // Upload image to Pinata
        const imageIpfsUri = await uploadFileToPinata(
          imageData,
          `${_id}-image.${mimeMatch ? mimeMatch[1].toLowerCase() : "bin"}`,
          mimeType
        );

        // Create metadata
        const metadata: any = {
          name: title,
          description,
          visual_aesthetic,
          image: imageIpfsUri,
          attributes: [], // Add any additional attributes here
        };

        // Upload metadata to Pinata
        const metadataIpfsUri = await uploadMetadataToPinata(
          metadata.description,
          metadata.image
        );

        // Step 3: Call the Abraham contract's newCreation function
        const tx = await abrahamContract.newCreation(metadataIpfsUri);
        const receipt = await tx.wait();

        // Step 4: Collect on-chain details
        results.push({
          creationId: _id,
          metadataIpfsUri,
          txHash: receipt.transactionHash,
          onchainDetails: receipt.events,
        });

        console.log(`Successfully created on-chain creation ID ${_id}`);
      } catch (creationError: any) {
        console.error(
          `Error processing creation ID ${creation._id}:`,
          creationError.message
        );
        results.push({
          creationId: creation._id,
          error: creationError.message,
        });
        continue; // Proceed with the next creation
      }
    }

    // Step 5: Return the results
    return NextResponse.json({ results }, { status: 200 });
  } catch (error: any) {
    console.error("Error processing GET request:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
