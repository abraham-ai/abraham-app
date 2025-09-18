import { NextRequest } from "next/server";

export async function getAuthToken(req: NextRequest): Promise<string | null> {
  const header =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (header && header.startsWith("Bearer ")) {
    return header.slice(7);
  }

  const cookieToken = req.cookies.get("eden_auth_token")?.value;
  if (cookieToken) return cookieToken;

  // Fallback to server-side admin key if explicitly allowed (not recommended for user actions)
  if (process.env.ABRAHAM_EDEN_ADMIN_API_KEY) {
    return process.env.ABRAHAM_EDEN_ADMIN_API_KEY;
  }

  return null;
}
