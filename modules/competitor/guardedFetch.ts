import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import {
  checkUrlSyntax,
  isPrivateIp,
  type UrlRefusalReason,
} from "./ssrf.ts";

/**
 * SERVER-ONLY guarded HTTP(S) transport with connect-time IP pinning —
 * the shared fetch pipeline under both the manual one-time page fetch
 * and the monitoring beta's scheduled checks.
 *
 * DNS-rebinding defense (the gap in the previous implementation):
 * hostnames are resolved ONCE per hop, every answer is validated
 * against private/reserved ranges, and the socket is then opened via
 * node:http(s) with a custom `lookup` that returns ONLY those
 * validated addresses. The connection layer can never re-resolve the
 * name, so a DNS answer that changes between validation and connect
 * cannot redirect the socket to an internal address. TLS still
 * verifies the certificate against the HOSTNAME (SNI/servername), and
 * the Host header is the hostname — only the socket target is pinned.
 *
 * Why node:http(s) and not an undici Agent: see Checkpoint 3 notes —
 * 'undici' is not an importable built-in and is not an approved
 * dependency; Node's built-in request API gives the same (stronger,
 * simpler) connect-time guarantee with zero new packages.
 *
 * Every redirect hop repeats the FULL pipeline: syntax/policy check,
 * DNS resolution, range validation, fresh pinned connection.
 *
 * No CAPTCHA/anti-bot evasion of any kind: 4xx/5xx and challenge
 * responses are returned as outcomes for the caller to record.
 * Honest, caller-supplied User-Agent. Nothing here logs URLs, hosts,
 * or response bodies.
 */

export interface GuardedFetchConfig {
  /** Overall deadline across ALL hops, connect + headers + body. */
  timeoutMs: number;
  maxRedirects: number;
  maxBytes: number;
  userAgent: string;
  /** truncate: keep the first maxBytes and mark truncated (manual
   *  fetch behavior). abort: fail with kind "too_large" (monitoring
   *  behavior). */
  onOversize: "truncate" | "abort";
  /** Test seams — production callers omit both. */
  resolver?: Resolver;
  transport?: Transport;
}

export type PinnedAddress = { address: string; family: number };

/** Resolves a hostname to ALL its addresses. Default: node:dns lookup. */
export type Resolver = (host: string) => Promise<PinnedAddress[]>;

export interface TransportResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: AsyncIterable<Uint8Array>;
  /** Idempotent; always called when the hop ends, success or not. */
  destroy: () => void;
}

export type Transport = (
  url: URL,
  pinned: PinnedAddress[],
  opts: { userAgent: string; deadlineAt: number }
) => Promise<TransportResponse>;

export type GuardedFetchOutcome =
  | {
      kind: "success";
      status: number;
      html: string;
      truncated: boolean;
      finalUrl: string;
    }
  | { kind: "refused"; reason: UrlRefusalReason } // pre-network
  | { kind: "dns_error" }
  | { kind: "ssrf_blocked" } // hostname resolved to private/reserved
  | { kind: "timeout" }
  | { kind: "redirect_loop" }
  | { kind: "http_error"; status: number; challenge: boolean }
  | { kind: "unsupported_content"; status: number }
  /** Server ignored our `accept-encoding: identity` and compressed
   *  anyway. Raw node:http does NOT auto-decompress, so this body
   *  must never reach the extractor (it would be garbage mislabeled
   *  as unsupported_content) — it is refused as its own kind. */
  | { kind: "unsupported_encoding"; status: number }
  | { kind: "too_large"; status: number }
  | { kind: "network_error" };

const defaultResolver: Resolver = async (host) => {
  const answers = await dnsLookup(host, { all: true, verbatim: true });
  return answers.map((a) => ({ address: a.address, family: a.family }));
};

/** Marker used to distinguish our deliberate deadline destroy from
 *  genuine socket errors. */
class DeadlineExceeded extends Error {
  constructor() {
    super("guarded fetch deadline exceeded");
    this.name = "DeadlineExceeded";
  }
}

/** Real transport: one fresh socket per request (agent: false — no
 *  keep-alive pool, so a pinned lookup can never be bypassed by a
 *  reused socket), custom lookup returning only validated addresses. */
const realTransport: Transport = (url, pinned, { userAgent, deadlineAt }) =>
  new Promise<TransportResponse>((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const mod = isHttps ? https : http;

    /* The pinning: Node asks this instead of DNS. Whether it wants one
       address or all (happy-eyeballs), it only ever sees the set we
       just validated. */
    const pinnedLookup = ((
      _hostname: string,
      options: { all?: boolean },
      callback: (
        err: NodeJS.ErrnoException | null,
        address: unknown,
        family?: number
      ) => void
    ) => {
      if (options && options.all) {
        callback(
          null,
          pinned.map((p) => ({ address: p.address, family: p.family }))
        );
      } else {
        callback(null, pinned[0].address, pinned[0].family);
      }
    }) as never; // node's LookupFunction overloads defeat exact typing

    const req = mod.request(
      {
        protocol: url.protocol,
        hostname: url.hostname, // Host header + TLS servername stay on the NAME
        port: url.port !== "" ? Number(url.port) : isHttps ? 443 : 80,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        agent: false,
        lookup: pinnedLookup,
        headers: {
          "user-agent": userAgent,
          accept: "text/html,application/xhtml+xml",
          // Identity only: raw node:http does not decompress, and we
          // never want to (no zip-bomb surface). A server that
          // compresses anyway is refused (unsupported_encoding).
          "accept-encoding": "identity",
          "accept-language": "en",
        },
      },
      (res) => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: res as AsyncIterable<Uint8Array>,
          destroy: () => {
            clearTimeout(timer);
            res.destroy();
            req.destroy();
          },
        });
      }
    );

    /* One timer covers connect + headers + body for this hop; firing
       destroys the socket, which surfaces as an error wherever the
       hop currently is (await below, or mid-body-read upstream). */
    const timer = setTimeout(
      () => req.destroy(new DeadlineExceeded()),
      Math.max(1, deadlineAt - Date.now())
    );
    timer.unref();

    req.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    req.end();
  });

async function readBody(
  res: TransportResponse,
  maxBytes: number,
  onOversize: "truncate" | "abort"
): Promise<{ html: string; truncated: boolean } | { overflow: true }> {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let html = "";
  let bytes = 0;
  for await (const chunk of res.body) {
    bytes += chunk.byteLength;
    if (bytes > maxBytes && onOversize === "abort") {
      return { overflow: true };
    }
    html += decoder.decode(chunk, { stream: true });
    if (bytes >= maxBytes) {
      // truncate mode: keep what we have, stop pulling.
      return { html: html + decoder.decode(), truncated: true };
    }
  }
  return { html: html + decoder.decode(), truncated: false };
}

export async function guardedFetch(
  rawUrl: string,
  cfg: GuardedFetchConfig
): Promise<GuardedFetchOutcome> {
  const resolver = cfg.resolver ?? defaultResolver;
  const transport = cfg.transport ?? realTransport;
  const deadlineAt = Date.now() + cfg.timeoutMs;
  let current = rawUrl.trim();

  for (let hop = 0; hop <= cfg.maxRedirects; hop++) {
    /* 1. Syntax + policy (scheme, creds, port, host blocklist, Ads
       Library, private IP literals) — every hop, no exceptions. */
    const syn = checkUrlSyntax(current);
    if (!syn.ok) return { kind: "refused", reason: syn.reason };
    const url = syn.url;

    /* 2. Resolve and validate EVERY answer; the surviving set is the
       only thing the socket layer will ever see. */
    const host = url.hostname.replace(/\.$/, "").toLowerCase();
    let pinned: PinnedAddress[];
    const literalFamily = isIP(host.startsWith("[") ? host.slice(1, -1) : host);
    if (literalFamily !== 0) {
      // Literal already validated non-private by checkUrlSyntax.
      pinned = [
        {
          address: host.startsWith("[") ? host.slice(1, -1) : host,
          family: literalFamily,
        },
      ];
    } else {
      let answers: PinnedAddress[];
      try {
        answers = await resolver(host);
      } catch {
        return { kind: "dns_error" };
      }
      if (answers.length === 0) return { kind: "dns_error" };
      if (answers.some((a) => isPrivateIp(a.address))) {
        return { kind: "ssrf_blocked" };
      }
      pinned = answers;
    }

    if (Date.now() >= deadlineAt) return { kind: "timeout" };

    /* 3. Fetch over a pinned connection. */
    let res: TransportResponse;
    try {
      res = await transport(url, pinned, {
        userAgent: cfg.userAgent,
        deadlineAt,
      });
    } catch (e) {
      if (e instanceof DeadlineExceeded || Date.now() >= deadlineAt) {
        return { kind: "timeout" };
      }
      return { kind: "network_error" };
    }

    try {
      /* 4. Redirects: destroy this hop, re-run the FULL pipeline. */
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers["location"];
        const loc = Array.isArray(location) ? location[0] : location;
        res.destroy();
        if (!loc || hop === cfg.maxRedirects) return { kind: "redirect_loop" };
        try {
          current = new URL(loc, url).toString();
        } catch {
          return { kind: "refused", reason: "invalid_url" };
        }
        continue;
      }

      if (res.status < 200 || res.status >= 300) {
        const cfMitigated = res.headers["cf-mitigated"];
        const challenge =
          (Array.isArray(cfMitigated) ? cfMitigated[0] : cfMitigated) ===
          "challenge";
        res.destroy();
        return { kind: "http_error", status: res.status, challenge };
      }

      /* 5a. Encoding gate BEFORE reading any body: we requested
         identity; a compressed response cannot be decoded here and
         must not reach the extractor. */
      const rawEncoding = res.headers["content-encoding"];
      const encoding = (
        (Array.isArray(rawEncoding) ? rawEncoding[0] : rawEncoding) ?? ""
      )
        .trim()
        .toLowerCase();
      if (encoding !== "" && encoding !== "identity") {
        res.destroy();
        return { kind: "unsupported_encoding", status: res.status };
      }

      /* 5b. Content-type gate BEFORE reading any body. */
      const rawType = res.headers["content-type"];
      const contentType = (
        (Array.isArray(rawType) ? rawType[0] : rawType) ?? ""
      ).toLowerCase();
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml")
      ) {
        res.destroy();
        return { kind: "unsupported_content", status: res.status };
      }

      /* 6. Declared-size sanity gate, then hard streamed cap. */
      const rawLength = res.headers["content-length"];
      const declared = Number(
        (Array.isArray(rawLength) ? rawLength[0] : rawLength) ?? 0
      );
      if (declared > cfg.maxBytes * 4) {
        res.destroy();
        return { kind: "too_large", status: res.status };
      }

      let read: Awaited<ReturnType<typeof readBody>>;
      try {
        read = await readBody(res, cfg.maxBytes, cfg.onOversize);
      } catch (e) {
        if (e instanceof DeadlineExceeded || Date.now() >= deadlineAt) {
          return { kind: "timeout" };
        }
        return { kind: "network_error" };
      }
      if ("overflow" in read) {
        return { kind: "too_large", status: res.status };
      }
      return {
        kind: "success",
        status: res.status,
        html: read.html,
        truncated: read.truncated,
        finalUrl: url.toString(),
      };
    } finally {
      res.destroy();
    }
  }
  return { kind: "redirect_loop" };
}
