import { NextRequest, NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";

const { PINATA_JWT } = process.env as Record<string, string>;

if (!PINATA_JWT) {
  throw new Error("Missing PINATA_JWT for /api/ipfs/message");
}

const pinata = new PinataSDK({ pinataJwt: PINATA_JWT });

export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = String(body?.sessionId || "");
    const messageId = String(body?.messageId || "");
    const content = typeof body?.content === "string" ? body.content : "";
    const author = String(body?.author || "");
    const kind = (body?.kind as string) || "blessing";

    if (!sessionId || !messageId || !content) {
      return NextResponse.json(
        {
          error:
            "`sessionId`, `messageId`, and non-empty `content` are required",
        },
        { status: 400 }
      );
    }

    const json = {
      version: 1,
      sessionId,
      messageId,
      author,
      kind,
      content,
      media: [], // blessings are text-only from UI; extend if needed
      createdAt: Math.floor(Date.now() / 1000),
    };

    const res = await pinata.upload.json(json);
    const cid = res.IpfsHash; // bare CID

    return NextResponse.json({ cid }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to pin blessing" },
      { status: 500 }
    );
  }
}
