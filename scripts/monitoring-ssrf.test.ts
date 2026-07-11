/**
 * Monitoring beta — SSRF validator, pinned-pipeline, and outcome-
 * mapping proofs. Runs under plain `node` like the other script
 * tests: `npm run test:monitoring-ssrf`.
 *
 * Network-free: DNS and the socket transport are injected fakes; the
 * assertions cover the validation pipeline's CONTRACT — every address
 * validated, every hop re-checked, the transport only ever handed
 * pre-validated pinned addresses (which is what makes rebinding
 * impossible with the real node:http(s) lookup-pinned transport).
 */
import assert from "node:assert/strict";
import {
  checkUrlSyntax,
  isPrivateIp,
  isPrivateIPv4,
} from "../modules/competitor/ssrf.ts";
import {
  guardedFetch,
  type GuardedFetchConfig,
  type PinnedAddress,
  type Transport,
  type TransportResponse,
} from "../modules/competitor/guardedFetch.ts";
import { runCheckAttempt } from "../modules/monitoring/fetcher.ts";

/* ------------------------- IPv4 ranges ---------------------------- */

const V4_PRIVATE = [
  "0.0.0.1",
  "10.0.0.1",
  "10.255.255.255",
  "127.0.0.1",
  "127.1.2.3",
  "100.64.0.1", // CGNAT low
  "100.127.255.255", // CGNAT high
  "169.254.169.254", // cloud metadata
  "169.254.0.1",
  "172.16.0.1",
  "172.31.255.255",
  "192.0.0.1",
  "192.0.2.44", // TEST-NET-1
  "192.168.1.1",
  "198.18.0.1",
  "198.19.255.255",
  "198.51.100.7", // TEST-NET-2
  "203.0.113.9", // TEST-NET-3
  "224.0.0.1", // multicast
  "240.0.0.1", // reserved
  "255.255.255.255", // broadcast
];
for (const ip of V4_PRIVATE) {
  assert.equal(isPrivateIPv4(ip), true, `${ip} must be private`);
  assert.equal(isPrivateIp(ip), true, `${ip} must be private (generic)`);
}

const V4_PUBLIC = [
  "8.8.8.8",
  "1.1.1.1",
  "93.184.216.34",
  "100.63.255.255", // just below CGNAT
  "100.128.0.1", // just above CGNAT
  "172.15.255.255", // just below 172.16/12
  "172.32.0.1", // just above 172.16/12
  "198.17.0.1", // just below benchmarking
  "223.255.255.255", // last public /8 before multicast
];
for (const ip of V4_PUBLIC) {
  assert.equal(isPrivateIPv4(ip), false, `${ip} must be public`);
}

/* ------------------------- IPv6 ranges ---------------------------- */

const V6_PRIVATE = [
  "::1",
  "::",
  "fe80::1", // link-local
  "fe90::1",
  "fea0::1",
  "feb0::1",
  "fc00::1", // ULA
  "fd12:3456::1",
  "ff02::1", // multicast
  "64:ff9b::808:808", // NAT64
  "2001:db8::1", // documentation
  "::ffff:127.0.0.1", // v4-mapped loopback
  "::ffff:10.0.0.1", // v4-mapped private
  "::ffff:169.254.169.254", // v4-mapped metadata
  "::ffff:192.168.0.1",
  "::ffff:a00:1", // v4-mapped 10.0.0.1 in HEX form (WHATWG URL serialization)
  "::ffff:7f00:1", // v4-mapped 127.0.0.1 in hex form
  "::ffff:a9fe:a9fe", // v4-mapped 169.254.169.254 in hex form
  "2002:a00:1::", // 6to4 embedding 10.0.0.1
  "2002:7f00:1::", // 6to4 embedding 127.0.0.1
  "2001:0:507:1234::1", // Teredo (obfuscated embedded v4) — refused
];
for (const ip of V6_PRIVATE) {
  assert.equal(isPrivateIp(ip), true, `${ip} must be private`);
}

const V6_PUBLIC = [
  "2606:4700::1111",
  "2a00:1450:4009::8a",
  "::ffff:8.8.8.8",
  "::ffff:808:808", // v4-mapped 8.8.8.8 in hex form — public
  "2002:5db8:d822::", // 6to4 embedding 93.184.216.34 — public
];
for (const ip of V6_PUBLIC) {
  assert.equal(isPrivateIp(ip), false, `${ip} must be public`);
}

/* --------------------- URL syntax / policy ------------------------ */

const refusal = (raw: string) => {
  const r = checkUrlSyntax(raw);
  assert.equal(r.ok, false, `${raw} must be refused`);
  return (r as { ok: false; reason: string }).reason;
};
const accepted = (raw: string) => {
  const r = checkUrlSyntax(raw);
  assert.equal(r.ok, true, `${raw} must be accepted`);
};

assert.equal(refusal("not a url"), "invalid_url");
assert.equal(refusal("ftp://example.com/"), "scheme");
assert.equal(refusal("javascript:alert(1)"), "scheme");
assert.equal(refusal("data:text/html,hi"), "scheme");
assert.equal(refusal("file:///etc/passwd"), "scheme");
assert.equal(refusal("https://user:pass@example.com/"), "credentials");
assert.equal(refusal("https://user@example.com/"), "credentials");
assert.equal(refusal("https://example.com:8080/"), "port");
assert.equal(refusal("http://example.com:22/"), "port");
assert.equal(refusal("http://localhost/"), "blocked_host");
assert.equal(refusal("http://foo.localhost/"), "blocked_host");
assert.equal(refusal("http://router.local/"), "blocked_host");
assert.equal(refusal("http://db.internal/"), "blocked_host");
assert.equal(refusal("http://nas.home.arpa/"), "blocked_host");
assert.equal(refusal("http://x.test/"), "blocked_host");
assert.equal(refusal("http://x.invalid/"), "blocked_host");
assert.equal(refusal("http://10.0.0.1/"), "ip_private");
assert.equal(refusal("http://127.0.0.1/"), "ip_private");
assert.equal(refusal("http://169.254.169.254/latest/meta-data/"), "ip_private");
assert.equal(refusal("http://[::1]/"), "ip_private");
assert.equal(refusal("http://[fe80::1]/"), "ip_private");
assert.equal(refusal("http://[::ffff:10.0.0.1]/"), "ip_private");
assert.equal(
  refusal("https://www.facebook.com/ads/library/?id=1"),
  "ads_library"
);
assert.equal(refusal("https://fb.com/ads/library"), "ads_library");
assert.equal(refusal("https://m.facebook.com/ads/library/x"), "ads_library");
accepted("https://www.facebook.com/somepage"); // non-Ads-Library FB page
accepted("https://example.com/landing");
accepted("https://example.com./trailing-dot");
accepted("https://example.com:443/explicit-port");
accepted("http://example.com:80/explicit-port");
accepted("http://8.8.8.8/ip-literal-public");
accepted("http://[2606:4700::1111]/v6-literal-public");

/* --------------- pinned pipeline with injected fakes -------------- */

const enc = new TextEncoder();
function mkResponse(
  status: number,
  headers: Record<string, string>,
  body = ""
): TransportResponse {
  return {
    status,
    headers,
    body: (async function* () {
      if (body !== "") yield enc.encode(body);
    })(),
    destroy() {},
  };
}

const PUB_A: PinnedAddress = { address: "93.184.216.34", family: 4 };
const PUB_B: PinnedAddress = { address: "2606:4700::1111", family: 6 };

interface FakeNet {
  resolves: Record<string, PinnedAddress[] | "throw">;
  responses: Record<string, TransportResponse>;
  resolverCalls: string[];
  transportCalls: { href: string; pinned: PinnedAddress[] }[];
}
function fakes(net: FakeNet): Pick<GuardedFetchConfig, "resolver" | "transport"> {
  return {
    resolver: async (host) => {
      net.resolverCalls.push(host);
      const r = net.resolves[host];
      if (r === undefined || r === "throw") throw new Error("NXDOMAIN");
      return r;
    },
    transport: (async (url, pinned) => {
      net.transportCalls.push({ href: url.href, pinned });
      const res = net.responses[url.href];
      if (!res) throw new Error("no scripted response");
      return res;
    }) satisfies Transport,
  };
}
const CFG = {
  timeoutMs: 5000,
  maxRedirects: 5,
  maxBytes: 1000,
  userAgent: "test",
  onOversize: "abort" as const,
};

// Success + pinning contract: transport receives EXACTLY the validated
// answers, and DNS was consulted exactly once for the host (rebinding
// defense: with the real transport, the socket lookup only ever sees
// this pinned set — there is no second resolution to poison).
{
  const net: FakeNet = {
    resolves: { "example.com": [PUB_A, PUB_B] },
    responses: {
      "https://example.com/": mkResponse(
        200,
        { "content-type": "text/html; charset=utf-8" },
        "<html><title>t</title></html>"
      ),
    },
    resolverCalls: [],
    transportCalls: [],
  };
  const out = await guardedFetch("https://example.com/", { ...CFG, ...fakes(net) });
  assert.equal(out.kind, "success");
  assert.deepEqual(net.transportCalls[0].pinned, [PUB_A, PUB_B]);
  assert.deepEqual(net.resolverCalls, ["example.com"]);
}

// One private answer among many => refused before any connection.
{
  const net: FakeNet = {
    resolves: { "evil.example": [PUB_A, { address: "10.0.0.5", family: 4 }] },
    responses: {},
    resolverCalls: [],
    transportCalls: [],
  };
  const out = await guardedFetch("https://evil.example/", { ...CFG, ...fakes(net) });
  assert.equal(out.kind, "ssrf_blocked");
  assert.equal(net.transportCalls.length, 0, "no connection may be attempted");
}

// DNS failure / empty answers.
{
  const net: FakeNet = { resolves: { "nx.example": "throw" }, responses: {}, resolverCalls: [], transportCalls: [] };
  assert.equal((await guardedFetch("https://nx.example/", { ...CFG, ...fakes(net) })).kind, "dns_error");
  const empty: FakeNet = { resolves: { "empty.example": [] }, responses: {}, resolverCalls: [], transportCalls: [] };
  assert.equal((await guardedFetch("https://empty.example/", { ...CFG, ...fakes(empty) })).kind, "dns_error");
}

// Redirect to a private IP literal => refused at hop 2, one connection.
{
  const net: FakeNet = {
    resolves: { "example.com": [PUB_A] },
    responses: {
      "https://example.com/": mkResponse(301, { location: "http://169.254.169.254/latest" }),
    },
    resolverCalls: [],
    transportCalls: [],
  };
  const out = await guardedFetch("https://example.com/", { ...CFG, ...fakes(net) });
  assert.deepEqual(out, { kind: "refused", reason: "ip_private" });
  assert.equal(net.transportCalls.length, 1);
}

// Redirect to a hostname that resolves private => ssrf_blocked; both
// hosts were re-resolved (per-hop full pipeline).
{
  const net: FakeNet = {
    resolves: {
      "example.com": [PUB_A],
      "internal.example": [{ address: "192.168.1.10", family: 4 }],
    },
    responses: {
      "https://example.com/": mkResponse(302, { location: "https://internal.example/admin" }),
    },
    resolverCalls: [],
    transportCalls: [],
  };
  const out = await guardedFetch("https://example.com/", { ...CFG, ...fakes(net) });
  assert.equal(out.kind, "ssrf_blocked");
  assert.deepEqual(net.resolverCalls, ["example.com", "internal.example"]);
}

// Relative Location resolution + redirect chain exceeding the cap.
{
  const chain: Record<string, TransportResponse> = {};
  for (let i = 0; i <= 6; i++) {
    chain[`https://example.com/r${i}`] = mkResponse(302, { location: `/r${i + 1}` });
  }
  const net: FakeNet = {
    resolves: { "example.com": [PUB_A] },
    responses: chain,
    resolverCalls: [],
    transportCalls: [],
  };
  const out = await guardedFetch("https://example.com/r0", { ...CFG, ...fakes(net) });
  assert.equal(out.kind, "redirect_loop");
  assert.equal(net.transportCalls.length, 6); // hops 0..5, then refused
  assert.equal(net.transportCalls[1].href, "https://example.com/r1"); // relative resolved
}

// Redirect with no Location header.
{
  const net: FakeNet = {
    resolves: { "example.com": [PUB_A] },
    responses: { "https://example.com/": mkResponse(301, {}) },
    resolverCalls: [],
    transportCalls: [],
  };
  assert.equal((await guardedFetch("https://example.com/", { ...CFG, ...fakes(net) })).kind, "redirect_loop");
}

// HTTP errors: status + challenge flag.
{
  const net: FakeNet = {
    resolves: { "example.com": [PUB_A] },
    responses: {
      "https://example.com/403": mkResponse(403, {}),
      "https://example.com/chl": mkResponse(503, { "cf-mitigated": "challenge" }),
    },
    resolverCalls: [],
    transportCalls: [],
  };
  assert.deepEqual(await guardedFetch("https://example.com/403", { ...CFG, ...fakes(net) }), {
    kind: "http_error",
    status: 403,
    challenge: false,
  });
  assert.deepEqual(await guardedFetch("https://example.com/chl", { ...CFG, ...fakes(net) }), {
    kind: "http_error",
    status: 503,
    challenge: true,
  });
}

// Content-type gate, declared-size gate, streamed-cap behaviors.
{
  const big = "x".repeat(2000);
  const net: FakeNet = {
    resolves: { "example.com": [PUB_A] },
    responses: {
      "https://example.com/pdf": mkResponse(200, { "content-type": "application/pdf" }),
      "https://example.com/huge": mkResponse(200, {
        "content-type": "text/html",
        "content-length": String(1000 * 5),
      }),
      "https://example.com/big": mkResponse(200, { "content-type": "text/html" }, big),
    },
    resolverCalls: [],
    transportCalls: [],
  };
  assert.equal((await guardedFetch("https://example.com/pdf", { ...CFG, ...fakes(net) })).kind, "unsupported_content");
  assert.equal((await guardedFetch("https://example.com/huge", { ...CFG, ...fakes(net) })).kind, "too_large");
  assert.equal((await guardedFetch("https://example.com/big", { ...CFG, ...fakes(net) })).kind, "too_large");
  // truncate mode keeps the capped prefix instead.
  const net2: FakeNet = {
    resolves: { "example.com": [PUB_A] },
    responses: {
      "https://example.com/big": mkResponse(200, { "content-type": "text/html" }, big),
    },
    resolverCalls: [],
    transportCalls: [],
  };
  const truncated = await guardedFetch("https://example.com/big", {
    ...CFG,
    onOversize: "truncate",
    ...fakes(net2),
  });
  assert.equal(truncated.kind, "success");
  assert.equal((truncated as { truncated: boolean }).truncated, true);
}

// CONDITION 1(b): a server that ignores `accept-encoding: identity`
// and compresses anyway is refused as unsupported_encoding — its body
// must never reach the extractor.
{
  const net: FakeNet = {
    resolves: { "example.com": [PUB_A] },
    responses: {
      "https://example.com/gz": mkResponse(
        200,
        { "content-type": "text/html", "content-encoding": "gzip" },
        "\x1f\x8b-not-really-html"
      ),
      "https://example.com/br": mkResponse(
        200,
        { "content-type": "text/html", "content-encoding": "br" },
        "compressed"
      ),
      "https://example.com/id": mkResponse(
        200,
        { "content-type": "text/html", "content-encoding": "identity" },
        "<html><title>ok</title></html>"
      ),
    },
    resolverCalls: [],
    transportCalls: [],
  };
  assert.deepEqual(
    await guardedFetch("https://example.com/gz", { ...CFG, ...fakes(net) }),
    { kind: "unsupported_encoding", status: 200 }
  );
  assert.deepEqual(
    await guardedFetch("https://example.com/br", { ...CFG, ...fakes(net) }),
    { kind: "unsupported_encoding", status: 200 }
  );
  // explicit identity is fine
  assert.equal(
    (await guardedFetch("https://example.com/id", { ...CFG, ...fakes(net) })).kind,
    "success"
  );
  // monitoring mapping: refused pre-extraction, distinct detail
  const mapped = await runCheckAttempt("https://example.com/", async () => ({
    kind: "unsupported_encoding" as const,
    status: 200,
  }));
  assert.equal(mapped.outcome, "unsupported_content");
  assert.match(mapped.detail, /unsupported encoding/);
}

// CONDITION 2: a redirect whose Location is a non-http(s) scheme is
// refused at the policy stage of the NEXT hop — pinned by test.
{
  for (const target of ["file:///etc/passwd", "data:text/html,hi", "ftp://example.com/x"]) {
    const net: FakeNet = {
      resolves: { "example.com": [PUB_A] },
      responses: {
        "https://example.com/": mkResponse(302, { location: target }),
      },
      resolverCalls: [],
      transportCalls: [],
    };
    const out = await guardedFetch("https://example.com/", { ...CFG, ...fakes(net) });
    assert.deepEqual(out, { kind: "refused", reason: "scheme" }, `redirect to ${target}`);
    assert.equal(net.transportCalls.length, 1, "no connection to the refused scheme");
  }
}

// Deadline: a transport slower than the budget => timeout.
{
  const out = await guardedFetch("https://example.com/", {
    ...CFG,
    timeoutMs: 20,
    resolver: async () => [PUB_A],
    transport: async () => {
      await new Promise((r) => setTimeout(r, 60));
      throw new Error("socket destroyed");
    },
  });
  assert.equal(out.kind, "timeout");
}

/* ------------- monitoring outcome mapping (runCheckAttempt) ------- */

const attempt = (o: object) =>
  runCheckAttempt("https://example.com/", async () => o as never);

{
  let r = await attempt({ kind: "http_error", status: 403, challenge: false });
  assert.equal(r.outcome, "blocked");
  assert.equal(r.transient, false, "blocked is never retried in-run");

  r = await attempt({ kind: "http_error", status: 429, challenge: false });
  assert.equal(r.outcome, "blocked");

  r = await attempt({ kind: "http_error", status: 503, challenge: true });
  assert.equal(r.outcome, "blocked", "challenge pages are blocked, not retried");

  r = await attempt({ kind: "http_error", status: 500, challenge: false });
  assert.equal(r.outcome, "error");
  assert.equal(r.transient, true, "5xx gets the single in-run retry");

  r = await attempt({ kind: "http_error", status: 404, challenge: false });
  assert.equal(r.outcome, "error");
  assert.equal(r.transient, false);

  r = await attempt({ kind: "timeout" });
  assert.equal(r.outcome, "timeout");
  assert.equal(r.transient, true);

  r = await attempt({ kind: "network_error" });
  assert.equal(r.outcome, "error");
  assert.equal(r.transient, false, "spec: transient list is timeout + 5xx only");

  r = await attempt({ kind: "dns_error" });
  assert.equal(r.outcome, "dns_error");

  r = await attempt({ kind: "ssrf_blocked" });
  assert.equal(r.outcome, "ssrf_blocked");

  r = await attempt({ kind: "refused", reason: "scheme" });
  assert.equal(r.outcome, "invalid_url");

  r = await attempt({ kind: "refused", reason: "ads_library" });
  assert.equal(r.outcome, "ssrf_blocked");

  r = await attempt({ kind: "redirect_loop" });
  assert.equal(r.outcome, "redirect_loop");

  r = await attempt({ kind: "too_large", status: 200 });
  assert.equal(r.outcome, "too_large");

  // Success with a real page => full snapshot.
  r = await attempt({
    kind: "success",
    status: 200,
    truncated: false,
    finalUrl: "https://example.com/",
    html: `<html><head><title>GlowLab Vitamin C Serum</title></head><body><h1>Glow brighter in 14 days</h1><a href="/shop">Shop now</a><p>Free shipping over $50. 30-day money back guarantee.</p></body></html>`,
  });
  assert.equal(r.outcome, "success");
  assert.ok(r.snapshot, "success must carry a snapshot");
  assert.equal(r.snapshot!.stored.completeness, "full");
  assert.match(r.snapshot!.contentHash, /^[0-9a-f]{64}$/);

  // Script-only shell => unsupported_content, no snapshot.
  r = await attempt({
    kind: "success",
    status: 200,
    truncated: false,
    finalUrl: "https://example.com/",
    html: "<html><body><script>boot()</script></body></html>",
  });
  assert.equal(r.outcome, "unsupported_content");
  assert.equal(r.snapshot, null);

  // detail strings never contain the URL.
  assert.ok(!r.detail.includes("example.com"));
}

console.log("monitoring-ssrf: all assertions passed");
