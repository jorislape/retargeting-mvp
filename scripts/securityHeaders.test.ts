/**
 * Baseline security headers — plain-Node proof for next.config.ts's
 * headers(). next.config.ts has no runtime "next" import (only a
 * type-only one), so it loads directly under plain Node exactly like
 * lib/site.ts does in scripts/site.test.ts.
 *
 * Locks in two things: the three baseline headers this milestone adds
 * (Paid Pilot Readiness V1), and the deliberate carve-out that keeps
 * /api/meta's own Referrer-Policy (no-referrer, set in
 * modules/meta/bridge.ts for the token-bearing OAuth bridge response)
 * as the only Referrer-Policy those routes ever see.
 */
import assert from "node:assert/strict";
import nextConfig from "../next.config.ts";

const groups = await nextConfig.headers!();

assert.equal(groups.length, 2, "exactly two header groups: broad baseline, then the Referrer-Policy carve-out");

/* ---- Group 1: HSTS + nosniff apply everywhere, including /api/meta —
        neither touches cookies, tokens, or redirect behavior. ---- */
{
  const [broad] = groups;
  assert.equal(broad.source, "/:path*", "the broad group matches every path, api/meta included");

  const byKey = Object.fromEntries(broad.headers.map((h) => [h.key, h.value]));
  assert.equal(
    byKey["Strict-Transport-Security"],
    "max-age=63072000; includeSubDomains",
    "HSTS: 2-year max-age, includeSubDomains — no 'preload' token, since the domain hasn't been submitted to the preload list"
  );
  assert.equal(byKey["X-Content-Type-Options"], "nosniff");
  assert.ok(
    !("Referrer-Policy" in byKey),
    "Referrer-Policy must NOT be in the broad group — it lives only in the carve-out group below"
  );
}

/* ---- Group 2: Referrer-Policy, scoped away from /api/meta. ---- */
{
  const [, carveOut] = groups;
  assert.equal(
    carveOut.source,
    "/((?!api/meta).*)",
    "the Referrer-Policy group's source is the exact negative-lookahead pattern excluding api/meta"
  );
  const byKey = Object.fromEntries(carveOut.headers.map((h) => [h.key, h.value]));
  assert.equal(byKey["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(carveOut.headers.length, 1, "this group sets nothing beyond Referrer-Policy");

  /* The source is a plain JS-regex-compatible pattern (no path-to-regexp
     :param syntax), so its own exclusion semantics can be checked
     directly rather than trusted blindly. This proves the STRING's
     regex behavior; it is not a simulation of Next's route matcher. */
  const re = new RegExp(`^${carveOut.source}$`);
  assert.ok(!re.test("/api/meta/login"), "api/meta/login must be excluded from the carve-out group");
  assert.ok(!re.test("/api/meta/callback"), "api/meta/callback must be excluded from the carve-out group");
  assert.ok(!re.test("/api/meta/config"), "every /api/meta/* route must be excluded, not just login/callback");
  assert.ok(re.test("/generator"), "ordinary app routes must still get the baseline Referrer-Policy");
  assert.ok(re.test("/api/debrief"), "non-Meta API routes must still get the baseline Referrer-Policy");
  assert.ok(re.test("/"), "the root path must still get the baseline Referrer-Policy");
}

/* ---- The pre-existing /vs-ai redirect must survive untouched — this
        milestone only adds headers(), never touches redirects(). ---- */
{
  const redirects = await nextConfig.redirects!();
  assert.equal(redirects.length, 1);
  assert.deepEqual(redirects[0], {
    source: "/vs-ai",
    destination: "/vs-chatgpt",
    permanent: true,
  });
}

console.log("securityHeaders: baseline headers present, Meta OAuth carve-out verified, redirects untouched");
