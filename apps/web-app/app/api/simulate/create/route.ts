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
  NEXT_PUBLIC_IPFS_GATEWAY,
} = process.env as Record<string, string>;

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT || !PINATA_JWT) {
  throw new Error("Missing env vars for /api/simulate/create route");
}

/*────────────────── ETHERS SETUP ───────────────*/
const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);
const abraham = new Contract(CONTRACT, AbrahamAbi, wallet);

/*────────────────── PINATA ─────────────────────*/
const pinata = new PinataSDK({ pinataJwt: PINATA_JWT });

async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Upload an image URL to Pinata (optional) → returns "ipfs://<imgCID>" */
async function uploadImageToPinata(imgUrl: string): Promise<string> {
  const buf = await fetchBytes(imgUrl);
  const file = new File([buf], "cover.png", { type: "image/png" });
  const uploaded = await pinata.upload.file(file);
  return `ipfs://${uploaded.IpfsHash}`;
}

/** Build the canonical message JSON we store on IPFS */
function buildMessageJson(params: {
  sessionId: string;
  messageId: string;
  author: string;
  content?: string;
  mediaSrc?: string; // can be ipfs://... or https://...
}): any {
  const { sessionId, messageId, author, content, mediaSrc } = params;
  const json: any = {
    version: 1,
    sessionId,
    messageId,
    author,
    kind: "owner",
    createdAt: Math.floor(Date.now() / 1000),
  };
  if (typeof content === "string") json.content = content;
  if (mediaSrc) {
    json.media = [
      {
        type: "image",
        src: mediaSrc,
        mime: "image/png",
      },
    ];
  } else {
    json.media = [];
  }
  return json;
}

/** Upload a message JSON to Pinata → returns bare CID (no ipfs:// prefix) */
async function uploadMessageJsonToPinata(json: any): Promise<string> {
  const res = await pinata.upload.json(json);
  return res.IpfsHash; // bare CID
}

/** Normalize to gateway URL for convenience in response payloads */
function toGatewayUrl(ipfsish: string): string {
  const base =
    (NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/").replace(
      /\/+$/,
      ""
    ) + "/";
  const path = ipfsish.replace(/^ipfs:\/\//i, "");
  return /^https?:\/\//i.test(ipfsish) ? ipfsish : base + path;
}

/*───────────────── POST /api/simulate/create ─────────
  Create a new session:
    {
      imageUrl?: string,  // optional; if pin=true we pin the image
      content?: string,   // optional
      pin?: boolean       // optional, default false
    }

  Flow:
   1) (optional) pin image to IPFS → ipfs://<imgCID>
   2) build message JSON {content, media:[{src: ...}], ...} → pin → <CID>
   3) call createSession(sessionId, firstMessageId, CID)
──────────────────────────────────────────────────────*/
export async function POST(req: NextRequest) {
  try {
    const { imageUrl, content, pin = false } = await req.json();

    const contentStr = typeof content === "string" ? content : "";
    let mediaSrc = typeof imageUrl === "string" ? imageUrl : "";

    // Optional: pin the image itself
    if (pin && mediaSrc) {
      mediaSrc = await uploadImageToPinata(mediaSrc);
    }

    if (!contentStr && !mediaSrc) {
      return NextResponse.json(
        { error: "At least one of `content` or `imageUrl` is required" },
        { status: 400 }
      );
    }

    const sessionId = randomUUID();
    const firstMessageId = randomUUID();

    // Build and pin the message JSON
    const messageJson = buildMessageJson({
      sessionId,
      messageId: firstMessageId,
      author: wallet.address,
      content: contentStr,
      mediaSrc,
    });
    const cid = await uploadMessageJsonToPinata(messageJson);

    // Contract: CID only (no ipfs://)
    const tx = await abraham.createSession(sessionId, firstMessageId, cid);
    const rcpt = await tx.wait();

    return NextResponse.json(
      {
        txHash: rcpt?.hash ?? rcpt?.transactionHash,
        sessionId,
        firstMessageId,
        cid,
        // convenience echoes
        content: contentStr,
        imageUrl: mediaSrc ? toGatewayUrl(mediaSrc) : "",
        closed: false, // sessions start OPEN by default
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("/api/simulate/create POST:", e);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}

/*──────────────── PATCH /api/simulate/create ─────────
  Append an owner message and optionally toggle closed:
    {
      sessionId: string,
      content?: string,
      imageUrl?: string,
      closed?: boolean, // default true (close)
      pin?: boolean
    }

  Flow:
   1) (optional) pin image → ipfs://<imgCID>
   2) build message JSON → pin → <CID>
   3) abrahamUpdate(sessionId, messageId, CID, closed)
──────────────────────────────────────────────────────*/
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
      typeof body?.closed === "boolean" ? body.closed : true; // default: close
    let mediaSrc = typeof body?.imageUrl === "string" ? body.imageUrl : "";
    const pin = !!body?.pin;

    if (pin && mediaSrc) {
      mediaSrc = await uploadImageToPinata(mediaSrc);
    }

    if (!contentStr && !mediaSrc) {
      return NextResponse.json(
        { error: "At least one of `content` or `imageUrl` is required" },
        { status: 400 }
      );
    }

    const messageId = randomUUID();

    // Build & pin JSON, then send CID
    const messageJson = buildMessageJson({
      sessionId,
      messageId,
      author: wallet.address,
      content: contentStr,
      mediaSrc,
    });
    const cid = await uploadMessageJsonToPinata(messageJson);

    const tx = await abraham.abrahamUpdate(sessionId, messageId, cid, closed);
    const rcpt = await tx.wait();

    return NextResponse.json(
      {
        txHash: rcpt?.hash ?? rcpt?.transactionHash,
        sessionId,
        messageId,
        cid,
        // convenience echoes
        content: contentStr,
        imageUrl: mediaSrc ? toGatewayUrl(mediaSrc) : "",
        closed,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("/api/simulate/create PATCH:", e);
    return NextResponse.json(
      { error: e?.message ?? "internal error" },
      { status: 500 }
    );
  }
}
