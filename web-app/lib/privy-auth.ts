import { jwtVerify, createRemoteJWKSet } from "jose";

// Privy access token verification via JWKS endpoint.
// Env vars:
//   NEXT_PUBLIC_PRIVY_APP_ID  -> audience check
//   PRIVY_JWKS_URL            -> JWKS endpoint URL (e.g. https://auth.privy.io/api/v1/apps/cm6nnln65002tnmxm76wprvjm/jwks.json)
//
// Returns normalized claims or null if invalid.

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const RAW_JWKS =
  process.env.PRIVY_JWKS_URL ||
  "https://auth.privy.io/api/v1/apps/cm6nnln65002tnmxm76wprvjm/jwks.json";

if (!APP_ID) console.warn("[privy-auth] NEXT_PUBLIC_PRIVY_APP_ID missing.");

function sanitizeJwksUrl(raw: string): string {
  if (!raw)
    return "https://auth.privy.io/api/v1/apps/cm6nnln65002tnmxm76wprvjm/jwks.json";
  let v = raw.trim();
  // strip surrounding quotes if present
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  if (!/^https?:\/\//i.test(v)) {
    // If someone only pasted domain/path, prepend https
    v = "https://" + v.replace(/^\/*/, "");
  }
  return v;
}

let jwksSet: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (jwksSet) return jwksSet;
  const urlStr = sanitizeJwksUrl(RAW_JWKS);
  try {
    const url = new URL(urlStr);
    jwksSet = createRemoteJWKSet(url);
  } catch (e) {
    console.error("[privy-auth] Invalid PRIVY_JWKS_URL value:", RAW_JWKS, e);
    // fallback to default official endpoint
    jwksSet = createRemoteJWKSet(
      new URL(
        "https://auth.privy.io/api/v1/apps/cm6nnln65002tnmxm76wprvjm/jwks.json"
      )
    );
  }
  return jwksSet;
}

export interface PrivyAuthClaims {
  appId: string;
  userId: string; // DID (sub)
  issuer: string;
  issuedAt: string;
  expiration: string;
  sessionId?: string;
  sub: string;
  [k: string]: any;
}

export async function verifyPrivyToken(
  token: string
): Promise<PrivyAuthClaims | null> {
  if (!token || !APP_ID) return null;
  try {
    const JWKS = getJwks();
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: "privy.io",
      audience: APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID,
      algorithms: ["ES256"],
    });
    const claims: PrivyAuthClaims = {
      appId: (payload as any).appId || APP_ID,
      userId: (payload as any).sub as string,
      issuer: (payload as any).iss || "privy.io",
      issuedAt: new Date(((payload as any).iat ?? 0) * 1000).toISOString(),
      expiration: new Date(((payload as any).exp ?? 0) * 1000).toISOString(),
      sessionId: (payload as any).sessionId,
      sub: (payload as any).sub as string,
      ...payload,
    };
    return claims;
  } catch (e) {
    console.warn(
      "[privy-auth] token verification failed:",
      (e as any)?.message
    );
    return null;
  }
}
