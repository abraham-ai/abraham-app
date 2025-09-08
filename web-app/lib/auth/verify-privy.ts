import { jwtVerify, createRemoteJWKSet } from "jose";

const PRIVY_JWKS = new URL("https://auth.privy.io/api/v1/keys");
const jwks = createRemoteJWKSet(PRIVY_JWKS);

export type PrivySession = {
  sub: string; // privy user id
  email?: string;
  wallet?: string;
  /** epoch seconds */
  exp: number;
};

/**
 * Verify a Bearer token from the Authorization header against Privy JWKS.
 * Returns a minimal session payload if valid. Throws on failure.
 */
export async function verifyPrivyBearer(req: Request): Promise<PrivySession> {
  const auth =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const token = auth.slice(7).trim();

  try {
    const { payload } = await jwtVerify(token, jwks, {
      // audience: process.env.NEXT_PUBLIC_PRIVY_APP_ID, // optionally enforce
      // issuer: "https://auth.privy.io", // optionally enforce
    });

    const sess: PrivySession = {
      sub: String(payload.sub || ""),
      email:
        typeof payload["email"] === "string"
          ? (payload["email"] as string)
          : undefined,
      wallet:
        typeof payload["wallet"] === "string"
          ? (payload["wallet"] as string)
          : undefined,
      exp: Number(payload.exp || 0),
    };
    if (!sess.sub) throw new Error("Missing subject");
    return sess;
  } catch (err) {
    console.error("[auth] Privy token verify failed", err);
    throw new Response("Unauthorized", { status: 401 });
  }
}
