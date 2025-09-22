export function isInWarpcastMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Basic heuristic: Warpcast embeds a recognizable UA token
  return /Warpcast/i.test(ua) || /Farcaster/i.test(ua);
}
