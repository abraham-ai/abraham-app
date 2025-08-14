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
  throw new Error("Missing env vars for /api/creations/batch route");
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

async function pinIfNeeded(url?: string, text?: string, pin?: boolean) {
  if (!pin || !url) return url || "";
  const buf = await fetchBytes(url);
  const file = new File([buf], "cover.png", { type: "image/png" });
  const img = await pinata.upload.file(file);
  const meta = await pinata.upload.json({
    name: "Abraham Creation",
    description: text || "",
    image: `ipfs://${img.IpfsHash}`,
  });
  return `ipfs://${meta.IpfsHash}`;
}

/*──────────────── POST /api/creations/batch ──────────────
  **Batch create sessions** across many sessions:
  Body:
    {
      items: Array<{
        sessionId?: string,       // optional; generated if missing
        firstMessageId?: string,  // optional; generated if missing
        content?: string,         // may be ""
        imageUrl?: string,        // may be ""; pinned if pin=true
      }>,
      pin?: boolean               // optional; default false
    }

  Notes:
  - Each item must have content or imageUrl (media).
  - Emits SessionCreated + MessageAdded per item.
──────────────────────────────────────────────────────────*/
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const itemsIn: any[] = Array.isArray(body?.items) ? body.items : [];
    const pin = !!body?.pin;

    if (!itemsIn.length) {
      return NextResponse.json({ error: "No items" }, { status: 400 });
    }

    // Normalize & (optionally) pin
    const items = [];
    for (const raw of itemsIn) {
      const sessionId =
        typeof raw?.sessionId === "string" && raw.sessionId.length
          ? raw.sessionId
          : randomUUID();
      const firstMessageId =
        typeof raw?.firstMessageId === "string" && raw.firstMessageId.length
          ? raw.firstMessageId
          : randomUUID();

      const content = typeof raw?.content === "string" ? raw.content : "";
      const mediaUri = await pinIfNeeded(raw?.imageUrl, content, pin); // may be ""

      if (!content && !mediaUri) {
        return NextResponse.json(
          { error: "Each item must include `content` or `imageUrl`" },
          { status: 400 }
        );
      }

      items.push({
        sessionId,
        firstMessageId,
        content,
        media: mediaUri,
      });
    }

    const tx = await abraham.abrahamBatchCreate(items);
    const rcpt = await tx.wait();

    return NextResponse.json(
      {
        txHash: rcpt?.hash ?? rcpt?.transactionHash,
        created: items.map((i) => ({
          sessionId: i.sessionId,
          firstMessageId: i.firstMessageId,
          content: i.content,
          media: i.media,
        })),
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("/api/creations/batch POST:", e);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}

/*──────────────── PATCH /api/creations/batch ─────────────
  **Batch update across sessions** (one message per session):
  Body:
    {
      items: Array<{
        sessionId: string,        // required
        messageId?: string,       // optional; generated if missing
        content?: string,         // may be ""
        imageUrl?: string,        // may be ""; pinned if pin=true
      }>,
      pin?: boolean               // optional; default false
    }

  Notes:
  - Does NOT toggle closed/open state. Use single /api/creations PATCH for that.
  - Emits one MessageAdded per item.
──────────────────────────────────────────────────────────*/
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const itemsIn: any[] = Array.isArray(body?.items) ? body.items : [];
    const pin = !!body?.pin;

    if (!itemsIn.length) {
      return NextResponse.json({ error: "No items" }, { status: 400 });
    }

    const items = [];
    for (const raw of itemsIn) {
      const sessionId =
        typeof raw?.sessionId === "string" && raw.sessionId.length
          ? raw.sessionId
          : "";
      if (!sessionId) {
        return NextResponse.json(
          { error: "Every item requires `sessionId`" },
          { status: 400 }
        );
      }

      const messageId =
        typeof raw?.messageId === "string" && raw.messageId.length
          ? raw.messageId
          : randomUUID();

      const content = typeof raw?.content === "string" ? raw.content : "";
      const mediaUri = await pinIfNeeded(raw?.imageUrl, content, pin);

      if (!content && !mediaUri) {
        return NextResponse.json(
          { error: "Each item must include `content` or `imageUrl`" },
          { status: 400 }
        );
      }

      items.push({
        sessionId,
        messageId,
        content,
        media: mediaUri,
      });
    }

    const tx = await abraham.abrahamBatchUpdateAcrossSessions(items);
    const rcpt = await tx.wait();

    return NextResponse.json(
      {
        txHash: rcpt?.hash ?? rcpt?.transactionHash,
        updated: items.map((i) => ({
          sessionId: i.sessionId,
          messageId: i.messageId,
          content: i.content,
          media: i.media,
        })),
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("/api/creations/batch PATCH:", e);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
