import { isIP } from "node:net";

/**
 * Pure SSRF validators — no I/O, no DNS, importable under plain Node
 * for exhaustive testing (scripts/monitoring-ssrf.test.ts).
 *
 * Shared by the two server-side fetch paths:
 *   - the manual one-time fetch (modules/competitor/server.ts), and
 *   - the monitoring fetcher (modules/monitoring/fetcher.ts),
 * both of which go through modules/competitor/guardedFetch.ts. Note
 * the import direction: monitoring imports from here (core); core
 * never imports monitoring.
 *
 * Philosophy: conservative allowlisting. Anything not clearly a
 * public unicast address is treated as private; anything not plain
 * http/https on standard ports without credentials is refused.
 */

/* ---------------------------- IP checks --------------------------- */

export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return true;
  const [a, b] = parts;
  return (
    a === 0 || // "this network"
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) || // 192.0.0/24 + 192.0.2/24 (conservative)
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51) || // 198.51.100/24 (conservative)
    (a === 203 && b === 0) || // 203.0.113/24 (conservative)
    a >= 224 // multicast, reserved, broadcast
  );
}

/** Parses a valid IPv6 string into its 8 16-bit groups. Handles ::
 *  compression and dotted-quad tails. Returns null when unparseable —
 *  callers treat that as private (conservative). */
function v6Groups(ip: string): number[] | null {
  let s = ip;
  // Dotted-quad tail (::ffff:10.0.0.1) → two hex groups first.
  const m = s.match(/^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const q = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
    if (q.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    s = `${m[1]}${(((q[0] << 8) | q[1]) >>> 0).toString(16)}:${(((q[2] << 8) | q[3]) >>> 0).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] === "" ? [] : halves[0].split(":");
  const right =
    halves.length === 2 && halves[1] !== "" ? halves[1].split(":") : [];
  const fill = 8 - left.length - right.length;
  if (halves.length === 2 ? fill < 0 : left.length !== 8) return null;
  const groups = [
    ...left,
    ...(halves.length === 2 ? Array(fill).fill("0") : []),
    ...right,
  ].map((g) => parseInt(g, 16));
  if (groups.length !== 8) return null;
  if (groups.some((n) => Number.isNaN(n) || n < 0 || n > 0xffff)) return null;
  return groups;
}

/**
 * Conservative: anything not clearly a public unicast address is
 * treated as private. IPv6 is judged on its PARSED groups (not string
 * prefixes), so v4-mapped addresses are caught in hex spelling
 * (::ffff:a00:1) as well as dotted (::ffff:10.0.0.1) — WHATWG URLs
 * serialize v6 literals in hex form, which the previous string-prefix
 * check missed. Embedded-IPv4 forms (mapped, 6to4) are judged by
 * their embedded address; NAT64/Teredo/documentation ranges are
 * refused outright.
 */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);
  const g = v6Groups(ip.toLowerCase());
  if (g === null) return true; // unparseable → refuse
  const embeddedV4 = (hi: number, lo: number): string =>
    `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

  // Unspecified (::) and loopback (::1)
  if (g.every((n, i) => (i === 7 ? n <= 1 : n === 0))) return true;
  // IPv4-mapped ::ffff:0:0/96 → judge the embedded IPv4
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
    return isPrivateIPv4(embeddedV4(g[6], g[7]));
  }
  if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((g[0] & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast ff00::/8
  if (g[0] === 0x64 && g[1] === 0xff9b) return true; // NAT64 64:ff9b::/32 (conservative)
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x2001 && g[1] === 0x0000) return true; // Teredo (obfuscated embedded v4) — refuse
  if (g[0] === 0x2002) return isPrivateIPv4(embeddedV4(g[1], g[2])); // 6to4 — judge embedded v4
  return false;
}

/* --------------------------- URL guard ---------------------------- */

export const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".test",
  ".invalid",
] as const;

/** Facebook-family hosts whose Ads Library paths are refused by
 *  policy — no Debrief feature reads Ads Library, in any form. */
export const ADS_LIBRARY_HOSTS = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "fb.watch",
] as const;

export type UrlRefusalReason =
  | "invalid_url" // unparseable
  | "scheme" // not http/https
  | "credentials" // user:pass@ embedded
  | "port" // non-80/443
  | "blocked_host" // localhost / internal-suffix hosts
  | "ads_library" // policy refusal
  | "ip_private"; // literal private/reserved IP

export type UrlSyntaxResult =
  | { ok: true; url: URL }
  | { ok: false; reason: UrlRefusalReason };

/**
 * Syntactic + policy validation for one URL (initial or redirect
 * hop). No network: literal IPs are judged here; hostnames are
 * resolved and validated by the caller (guardedFetch) against
 * isPrivateIp for EVERY answer.
 */
export function checkUrlSyntax(raw: string): UrlSyntaxResult {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  /* Protocol allowlist rejects javascript:, data:, file:, etc. */
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "scheme" };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, reason: "credentials" };
  }
  if (url.port !== "" && url.port !== "80" && url.port !== "443") {
    return { ok: false, reason: "port" };
  }

  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (
    host === "" ||
    host === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))
  ) {
    return { ok: false, reason: "blocked_host" };
  }
  const adsHost = ADS_LIBRARY_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`)
  );
  if (adsHost && /\/ads\/library/i.test(url.pathname)) {
    return { ok: false, reason: "ads_library" };
  }

  /* IP-literal hosts are judged immediately (URL.hostname strips the
     brackets from v6 literals). Decimal/hex IPv4 spellings don't parse
     as literals here — they go through DNS, whose answers are all
     validated by the caller. */
  const literal = host.startsWith("[") ? host.slice(1, -1) : host;
  if (isIP(literal) !== 0 && isPrivateIp(literal)) {
    return { ok: false, reason: "ip_private" };
  }
  return { ok: true, url };
}
