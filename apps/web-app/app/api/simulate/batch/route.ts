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
  throw new Error("Missing env vars for /api/simulate/create/batch route");
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

async function uploadImageToPinata(imgUrl: string): Promise<string> {
  const buf = await fetchBytes(imgUrl);
  const file = new File([buf], "cover.png", { type: "image/png" });
  const uploaded = await pinata.upload.file(file);
  return `ipfs://${uploaded.IpfsHash}`;
}

function buildMessageJson(params: {
  sessionId: string;
  messageId: string;
  author: string;
  content?: string;
  mediaSrc?: string;
  kind?: "owner" | "blessing";
}) {
  const {
    sessionId,
    messageId,
    author,
    content,
    mediaSrc,
    kind = "owner",
  } = params;
  const json: any = {
    version: 1,
    sessionId,
    messageId,
    author,
    kind,
    createdAt: Math.floor(Date.now() / 1000),
  };
  if (typeof content === "string") json.content = content;
  if (mediaSrc) {
    json.media = [{ type: "image", src: mediaSrc, mime: "image/png" }];
  } else {
    json.media = [];
  }
  return json;
}

async function uploadMessageJsonToPinata(json: any): Promise<string> {
  const res = await pinata.upload.json(json);
  return res.IpfsHash; // bare CID
}

function toGatewayUrl(ipfsish: string): string {
  const base =
    (NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/").replace(
      /\/+$/,
      ""
    ) + "/";
  const path = ipfsish.replace(/^ipfs:\/\//i, "");
  return /^https?:\/\//i.test(ipfsish) ? ipfsish : base + path;
}

/*──────────────── POST /api/simulate/create/batch ──────────────
  **Batch create sessions**

  Body:
    {
      items: Array<{
        sessionId?: string,       // optional; generated if missing
        firstMessageId?: string,  // optional; generated if missing
        content?: string,         // may be ""
        imageUrl?: string,        // may be ""; pinned if pin=true
        kind?: "owner" | "blessing"  // optional; default "owner"
      }>,
      pin?: boolean               // optional; default false
    }

  Steps per item: (optional) pin image → build message JSON → pin message JSON → CID
  Contract: abrahamBatchCreate([{ sessionId, firstMessageId, cid }])
────────────────────────────────────────────────────────────────*/
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const itemsIn: any[] = Array.isArray(body?.items) ? body.items : [];
    const pin = !!body?.pin;

    if (!itemsIn.length) {
      return NextResponse.json({ error: "No items" }, { status: 400 });
    }

    const normalized = [];
    for (const raw of itemsIn) {
      const sessionId =
        raw?.sessionId && String(raw.sessionId).length
          ? String(raw.sessionId)
          : randomUUID();
      const firstMessageId =
        raw?.firstMessageId && String(raw.firstMessageId).length
          ? String(raw.firstMessageId)
          : randomUUID();
      const content = typeof raw?.content === "string" ? raw.content : "";
      let mediaSrc = typeof raw?.imageUrl === "string" ? raw.imageUrl : "";
      const kind = raw?.kind === "blessing" ? "blessing" : "owner";

      if (pin && mediaSrc) {
        mediaSrc = await uploadImageToPinata(mediaSrc);
      }

      if (!content && !mediaSrc) {
        return NextResponse.json(
          { error: "Each item must include `content` or `imageUrl`" },
          { status: 400 }
        );
      }

      const json = buildMessageJson({
        sessionId,
        messageId: firstMessageId,
        author: wallet.address,
        content,
        mediaSrc,
        kind,
      });
      const cid = await uploadMessageJsonToPinata(json);

      normalized.push({
        sessionId,
        firstMessageId,
        cid,
        echo: { content, mediaSrc },
      });
    }

    const tx = await abraham.abrahamBatchCreate(
      normalized.map((n) => ({
        sessionId: n.sessionId,
        firstMessageId: n.firstMessageId,
        cid: n.cid,
      }))
    );
    const rcpt = await tx.wait();

    return NextResponse.json(
      {
        txHash: rcpt?.hash ?? rcpt?.transactionHash,
        created: normalized.map((n) => ({
          sessionId: n.sessionId,
          firstMessageId: n.firstMessageId,
          cid: n.cid,
          content: n.echo.content,
          imageUrl: n.echo.mediaSrc ? toGatewayUrl(n.echo.mediaSrc) : "",
        })),
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("/api/simulate/create/batch POST:", e);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}

/*──────────────── PATCH /api/simulate/create/batch ─────────────
  **Batch update across sessions** (one owner message per session)

  Body:
    {
      items: Array<{
        sessionId: string,        // required
        messageId?: string,       // optional; generated if missing
        content?: string,         // may be ""
        imageUrl?: string,        // may be ""; pinned if pin=true
        closed?: boolean          // optional; if omitted, we preserve current state
      }>,
      pin?: boolean               // optional; default false
    }

  Steps per item: (optional) pin image → build message JSON → pin → CID
  Contract: abrahamBatchUpdateAcrossSessions([{ sessionId, messageId, cid, closed }])
────────────────────────────────────────────────────────────────*/
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const itemsIn: any[] = Array.isArray(body?.items) ? body.items : [];
    const pin = !!body?.pin;

    if (!itemsIn.length) {
      return NextResponse.json({ error: "No items" }, { status: 400 });
    }

    // Determine current closed states for sessions we’ll touch (to preserve when closed is omitted)
    const uniqueSessionIds = Array.from(
      new Set(
        itemsIn
          .map((i) => (typeof i?.sessionId === "string" ? i.sessionId : ""))
          .filter(Boolean)
      )
    );
    const closedBySession = new Map<string, boolean>();
    await Promise.all(
      uniqueSessionIds.map(async (sid) => {
        const isClosed: boolean = await abraham.isSessionClosed(sid);
        closedBySession.set(sid, isClosed);
      })
    );

    const normalized = [];
    for (const raw of itemsIn) {
      const sessionId = typeof raw?.sessionId === "string" ? raw.sessionId : "";
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
      let mediaSrc = typeof raw?.imageUrl === "string" ? raw.imageUrl : "";
      const closed =
        typeof raw?.closed === "boolean"
          ? !!raw.closed
          : closedBySession.get(sessionId) ?? false; // preserve existing state

      if (pin && mediaSrc) {
        mediaSrc = await uploadImageToPinata(mediaSrc);
      }

      if (!content && !mediaSrc) {
        return NextResponse.json(
          { error: "Each item must include `content` or `imageUrl`" },
          { status: 400 }
        );
      }

      const json = buildMessageJson({
        sessionId,
        messageId,
        author: wallet.address,
        content,
        mediaSrc,
        kind: "owner",
      });
      const cid = await uploadMessageJsonToPinata(json);

      normalized.push({
        sessionId,
        messageId,
        cid,
        closed,
        echo: { content, mediaSrc },
      });
    }

    const tx = await abraham.abrahamBatchUpdateAcrossSessions(
      normalized.map((n) => ({
        sessionId: n.sessionId,
        messageId: n.messageId,
        cid: n.cid,
        closed: n.closed,
      }))
    );
    const rcpt = await tx.wait();

    return NextResponse.json(
      {
        txHash: rcpt?.hash ?? rcpt?.transactionHash,
        updated: normalized.map((n) => ({
          sessionId: n.sessionId,
          messageId: n.messageId,
          cid: n.cid,
          content: n.echo.content,
          imageUrl: n.echo.mediaSrc ? toGatewayUrl(n.echo.mediaSrc) : "",
          closed: n.closed,
        })),
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("/api/simulate/create/batch PATCH:", e);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
