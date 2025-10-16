/**
 * Normalize an image URL for social meta tags:
 * - Convert ipfs://... to a public HTTPS gateway URL
 * - Make relative paths absolute using origin
 * - Drop data: URLs (return null to allow caller fallback)
 */
export function normalizeImageUrl(
  input: string | undefined | null,
  origin: string | null,
  opts?: { ipfsGateway?: string }
): string | null {
  if (!input) return null;
  const url = input.trim();
  if (!url) return null;

  if (url.startsWith("data:")) return null;

  if (/^ipfs:\/\//i.test(url)) {
    const cidPath = url.replace(/^ipfs:\/\//i, "");
    const gateway = opts?.ipfsGateway || "https://gateway.pinata.cloud";
    return `${gateway}/ipfs/${cidPath}`;
  }

  if (/^https?:\/\//i.test(url)) return url;

  if (origin) {
    if (url.startsWith("/")) return `${origin}${url}`;
    return `${origin}/${url.replace(/^\.+\/?/, "")}`;
  }

  return null;
}
