// /lib/ipfs.ts
type GatewayBase = string;

export type IpfsMediaItem = { src: string; type?: string; mime?: string };
export type IpfsMessageJSON = {
  version?: number;
  sessionId?: string;
  messageId?: string;
  author?: string;
  kind?: "owner" | "blessing" | string;
  content?: string;
  media?: IpfsMediaItem[];
  createdAt?: number;
};

const ENV_PREFERRED =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://cloudflare-ipfs.com/ipfs/";
const DEFAULT_FALLBACKS: readonly GatewayBase[] = [
  ENV_PREFERRED,
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
] as const;

// --- small helpers ---

function trimSlash(s: string) {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
function ensureTrailingSlash(s: string) {
  return s.endsWith("/") ? s : s + "/";
}

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}
function isDataUrl(s: string) {
  return /^data:/i.test(s);
}

// Very lightweight checks for CIDv0 (base58btc, Qm...) or CIDv1 (base32, lowercase, often bafy…)
function isProbablyCid(str: string): boolean {
  if (!str) return false;
  // CIDv0
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(str)) return true;
  // CIDv1 (base32)
  if (/^[a-z2-7]{46,}$/i.test(str) && str.length >= 46 && /^[a-z2-7]/.test(str))
    return true;
  return false;
}

/** Result of parsing an "IPFS-ish" reference. */
type ParsedRef =
  | {
      kind: "ipfs"; // /ipfs/<cid>/<rest?>
      path: string; // "<cid>/<rest?>"
      search?: string;
      hash?: string;
    }
  | {
      kind: "ipns"; // /ipns/<name>/<rest?>
      namePath: string; // "<name>/<rest?>"
      search?: string;
      hash?: string;
    }
  | {
      kind: "http"; // already http(s) but *may* be an IPFS gateway URL
      url: string;
    }
  | {
      kind: "opaque"; // data:, blob:, or something we shouldn't touch
      value: string;
    };

/** Parse http gateway URL patterns (path-style or subdomain-style). */
function parseHttpGateway(u: URL): ParsedRef | null {
  // Path style: https://.../ipfs/<cid>/... OR https://.../ipns/<name>/...
  const m = u.pathname.match(/^\/(ipfs|ipns)\/([^/]+)(\/.*)?$/i);
  if (m) {
    const namespace = m[1].toLowerCase();
    const root = m[2];
    const rest = m[3] ? m[3].replace(/^\/+/, "") : "";
    const search = u.search || "";
    const hash = u.hash || "";
    if (namespace === "ipfs") {
      return {
        kind: "ipfs",
        path: rest ? `${root}/${rest}` : root,
        search,
        hash,
      };
    } else {
      return {
        kind: "ipns",
        namePath: rest ? `${root}/${rest}` : root,
        search,
        hash,
      };
    }
  }

  // Subdomain style: https://<cid>.ipfs.<domain>/<rest> OR https://<name>.ipns.<domain>/<rest>
  const hostParts = u.hostname.split(".");
  const idx = hostParts.findIndex((p) => p === "ipfs" || p === "ipns");
  if (idx > 0) {
    const namespace = hostParts[idx];
    const label = hostParts.slice(0, idx).join(".");
    const rest = u.pathname.replace(/^\/+/, "");
    const search = u.search || "";
    const hash = u.hash || "";
    if (namespace === "ipfs") {
      return {
        kind: "ipfs",
        path: rest ? `${label}/${rest}` : label,
        search,
        hash,
      };
    } else {
      return {
        kind: "ipns",
        namePath: rest ? `${label}/${rest}` : label,
        search,
        hash,
      };
    }
  }

  return null;
}

/** Normalize any IPFS-ish ref (cid, ipfs://, ipns://, gateway URL) into a canonical shape. */
export function parseIpfsRef(input: string): ParsedRef {
  if (!input) return { kind: "opaque", value: input };

  if (isDataUrl(input)) return { kind: "opaque", value: input };

  if (isHttpUrl(input)) {
    try {
      const u = new URL(input);
      const parsed = parseHttpGateway(u);
      return parsed ?? { kind: "http", url: input };
    } catch {
      return { kind: "http", url: input };
    }
  }

  // ipfs://<cid>/<rest?>
  if (/^ipfs:\/\//i.test(input)) {
    try {
      const u = new URL(input);
      const cid = u.host || "";
      const rest = u.pathname.replace(/^\/+/, "");
      return {
        kind: "ipfs",
        path: rest ? `${cid}/${rest}` : cid,
        search: u.search || "",
        hash: u.hash || "",
      };
    } catch {
      const clean = input.replace(/^ipfs:\/\//i, "");
      return { kind: "ipfs", path: clean };
    }
  }

  // ipns://<name>/<rest?>
  if (/^ipns:\/\//i.test(input)) {
    try {
      const u = new URL(input);
      const name = u.host || "";
      const rest = u.pathname.replace(/^\/+/, "");
      return {
        kind: "ipns",
        namePath: rest ? `${name}/${rest}` : name,
        search: u.search || "",
        hash: u.hash || "",
      };
    } catch {
      const clean = input.replace(/^ipns:\/\//i, "");
      return { kind: "ipns", namePath: clean };
    }
  }

  // raw CID or "cid/inner/file.png"
  const parts = input.split("/");
  const root = parts[0] || "";
  const rest = parts.slice(1).join("/");
  if (isProbablyCid(root)) {
    return { kind: "ipfs", path: rest ? `${root}/${rest}` : root };
  }

  // Unknown → leave as opaque
  return { kind: "opaque", value: input };
}

/** Build a gateway URL from an IPFS/IPNS path on a given base. */
export function toGatewayUrlFromParsed(
  ref: Extract<ParsedRef, { kind: "ipfs" | "ipns" }>,
  base: GatewayBase
): string {
  const b = ensureTrailingSlash(base);
  const suffix =
    ref.kind === "ipfs" ? `ipfs/${ref.path}` : `ipns/${ref.namePath}`;
  const url = b + suffix;
  return url + (ref.search || "") + (ref.hash || "");
}

/** Unified: turn any IPFS-ish ref into a URL on a specific gateway. */
export function toGatewayUrl(ref: string, base: GatewayBase): string {
  const p = parseIpfsRef(ref);
  if (p.kind === "ipfs" || p.kind === "ipns")
    return toGatewayUrlFromParsed(p, base);
  // If already http(s) or opaque (data:/blob:), return as-is.
  return ref;
}

// ---- Health-checked resolution with caching ----

type HealthCacheEntry = {
  url: string;
  ok: boolean;
  expiresAt: number;
  ctype?: string;
};
const HEALTH_TTL_MS = 1000 * 60 * 30; // 30 minutes
const healthCache: Map<string, HealthCacheEntry> =
  (global as any).__ipfs_health_cache__ || new Map();
(global as any).__ipfs_health_cache__ = healthCache;

/**
 * Test if a URL is fetchable (HEAD first; some gateways disallow HEAD → fallback to GET Range: 0-0).
 * Returns {ok, contentType?}.
 */
async function probeUrl(
  url: string,
  timeoutMs = 6000
): Promise<{ ok: boolean; ctype?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const head = await fetch(url, {
      method: "HEAD",
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (head.ok) {
      return { ok: true, ctype: head.headers.get("content-type") || undefined };
    }
  } catch {
    // ignore and try GET
  } finally {
    clearTimeout(t);
  }

  const ctrl2 = new AbortController();
  const t2 = setTimeout(() => ctrl2.abort(), timeoutMs);
  try {
    const get = await fetch(url, {
      method: "GET",
      signal: ctrl2.signal,
      headers: { Range: "bytes=0-0", Accept: "*/*" },
      cache: "no-store",
    });
    if (get.ok) {
      return { ok: true, ctype: get.headers.get("content-type") || undefined };
    }
  } catch {
    // fail
  } finally {
    clearTimeout(t2);
  }
  return { ok: false };
}

/**
 * Resolve any IPFS-ish ref to the first working gateway URL (preferred first).
 * Caches positive/negative results for HEALTH_TTL_MS.
 */
export async function ensureGatewayUrl(
  ref: string,
  gateways: readonly GatewayBase[] = DEFAULT_FALLBACKS
): Promise<{ url: string; contentType?: string } | null> {
  const parsed = parseIpfsRef(ref);

  // Already a non-IPFS http(s) or data: url → just return it (no health check)
  if (parsed.kind === "http") return { url: parsed.url };
  if (parsed.kind === "opaque") return { url: parsed.value };

  // Build candidate URLs across gateways
  const keyBase =
    parsed.kind === "ipfs" ? `ipfs:${parsed.path}` : `ipns:${parsed.namePath}`;
  const candidates = gateways.map((g) =>
    parsed.kind === "ipfs"
      ? toGatewayUrlFromParsed(parsed, g)
      : toGatewayUrlFromParsed(parsed, g)
  );

  // Try cache first
  for (const url of candidates) {
    const k = `${keyBase}@@${url}`;
    const cached = healthCache.get(k);
    if (cached && Date.now() < cached.expiresAt && cached.ok) {
      return { url: cached.url, contentType: cached.ctype };
    }
  }

  // Probe in order
  for (const url of candidates) {
    const k = `${keyBase}@@${url}`;
    const { ok, ctype } = await probeUrl(url);
    healthCache.set(k, {
      url,
      ok,
      ctype,
      expiresAt: Date.now() + HEALTH_TTL_MS,
    });
    if (ok) return { url, contentType: ctype };
  }

  return null;
}

// ---- JSON fetch with gateway fallback + LRU ----

type JsonCacheEntry = { value: IpfsMessageJSON | null; expiresAt: number };
const JSON_LRU_MAX = 5000;
const JSON_TTL_MS = 1000 * 60 * 60 * 12; // 12h
const jsonLRU: Map<string, JsonCacheEntry> =
  (global as any).__ipfs_json_lru_unified__ || new Map();
(global as any).__ipfs_json_lru_unified__ = jsonLRU;

function jsonGet(key: string): IpfsMessageJSON | null | undefined {
  const hit = jsonLRU.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    jsonLRU.delete(key);
    return undefined;
  }
  // refresh recency
  jsonLRU.delete(key);
  jsonLRU.set(key, hit);
  return hit.value;
}
function jsonSet(key: string, value: IpfsMessageJSON | null) {
  if (jsonLRU.size >= JSON_LRU_MAX) {
    const first = jsonLRU.keys().next().value;
    if (first) jsonLRU.delete(first);
  }
  jsonLRU.set(key, { value, expiresAt: Date.now() + JSON_TTL_MS });
}

/** Fetch JSON from any IPFS-ish ref, trying preferred gateway first with fallbacks. */
export async function fetchIpfsJson(
  ref: string,
  gateways: readonly GatewayBase[] = DEFAULT_FALLBACKS,
  timeoutMs = 8000
): Promise<IpfsMessageJSON | null> {
  const parsed = parseIpfsRef(ref);

  // Cache key = canonical ipfs/ipns path (not the gateway URL)
  let key = "";
  if (parsed.kind === "ipfs") key = `ipfs:${parsed.path}`;
  else if (parsed.kind === "ipns") key = `ipns:${parsed.namePath}`;
  else if (parsed.kind === "http") key = `http:${parsed.url}`;
  else key = `opaque:${parsed.value}`;

  const cached = jsonGet(key);
  if (cached !== undefined) return cached;

  // Build candidates (if http → just try that first, but also try canonical on gateways)
  const candidates: string[] = [];
  if (parsed.kind === "http") {
    candidates.push(parsed.url);
    // If it *is* a gateway URL we parsed earlier, parseHttpGateway would have normalized it
    const u = new URL(parsed.url);
    const maybe = parseHttpGateway(u);
    if (maybe && (maybe.kind === "ipfs" || maybe.kind === "ipns")) {
      const pathUrl = toGatewayUrlFromParsed(maybe, ENV_PREFERRED);
      candidates.unshift(pathUrl);
    }
  } else if (parsed.kind === "ipfs" || parsed.kind === "ipns") {
    for (const g of gateways) {
      candidates.push(toGatewayUrlFromParsed(parsed, g));
    }
  } else {
    // opaque (data:) → try to parse as JSON right away if it is data:
    if (isDataUrl(parsed.value)) {
      try {
        const comma = parsed.value.indexOf(",");
        const body = parsed.value.slice(comma + 1);
        const decoded = decodeURIComponent(body);
        const json = JSON.parse(decoded) as IpfsMessageJSON;
        jsonSet(key, json);
        return json;
      } catch {}
    }
    jsonSet(key, null);
    return null;
  }

  // Try candidates with timeout and Accept: application/json
  for (const url of candidates) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        signal: ctrl.signal,
        cache: "force-cache",
        next: { revalidate: 60 * 60 * 24 },
        headers: { Accept: "application/json" },
      });
      if (!r.ok) continue;
      const data = (await r.json()) as IpfsMessageJSON;
      jsonSet(key, data);
      return data;
    } catch {
      // try next
    } finally {
      clearTimeout(t);
    }
  }

  jsonSet(key, null);
  return null;
}

/** Convenience: pick the first media URL (if any) and resolve it to a live gateway URL. */
export async function firstResolvedMediaUrlFromJson(
  json: IpfsMessageJSON | null,
  gateways: readonly GatewayBase[] = DEFAULT_FALLBACKS
): Promise<string | null> {
  const src = json?.media?.[0]?.src;
  if (!src) return null;
  const resolved = await ensureGatewayUrl(src, gateways);
  return resolved?.url || null;
}
