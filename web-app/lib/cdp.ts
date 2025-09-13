import { CdpClient } from "@coinbase/cdp-sdk";

const API_KEY = process.env.CDP_API_KEY?.trim();
let RAW_API_SECRET = process.env.CDP_API_SECRET;
// Normalize possible escaped newlines in multi-line PEM values stored in .env
if (RAW_API_SECRET) {
  RAW_API_SECRET = RAW_API_SECRET.replace(/\\n/g, "\n").trim();
  // Strip wrapping quotes if present
  if (
    (RAW_API_SECRET.startsWith('"') && RAW_API_SECRET.endsWith('"')) ||
    (RAW_API_SECRET.startsWith("'") && RAW_API_SECRET.endsWith("'"))
  ) {
    RAW_API_SECRET = RAW_API_SECRET.slice(1, -1).trim();
  }
}
const API_SECRET = RAW_API_SECRET;
const NETWORK = process.env.CDP_NETWORK || "base-sepolia";

if (!API_KEY || !API_SECRET) {
  console.warn(
    "[CDP] Missing CDP_API_KEY or CDP_API_SECRET environment variables."
  );
} else {
  // Quick heuristic validation to aid developer before first call.
  const isPem = /-----BEGIN [A-Z ]+PRIVATE KEY-----/.test(API_SECRET);
  const isLikelyBase64 =
    /^[A-Za-z0-9+/=]+$/.test(API_SECRET) && API_SECRET.length >= 40; // Ed25519 base64 usually ~88 chars
  if (!isPem && !isLikelyBase64) {
    console.warn(
      "[CDP] CDP_API_SECRET does not look like a PEM block or base64 Ed25519 key. Check formatting (no 0x prefix, no truncation)."
    );
  }
  if (isPem && !API_SECRET.includes("\n")) {
    console.warn(
      "[CDP] PEM private key appears to be single-line; ensure newline characters are preserved (use escaped \\n in .env)."
    );
  }
}

let singleton: CdpClient | null = null;

export function getCdp() {
  if (!singleton) {
    if (!API_KEY || !API_SECRET) {
      throw new Error("CDP credentials not configured");
    }
    try {
      singleton = new CdpClient({
        apiKeyId: API_KEY,
        apiKeySecret: API_SECRET,
      });
    } catch (e: any) {
      console.error("[CDP] Failed to instantiate CdpClient:", e?.message || e);
      throw e;
    }
  }
  return singleton;
}

export function getCdpNetwork() {
  return NETWORK;
}
