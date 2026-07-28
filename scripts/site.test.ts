/**
 * SEO/social metadata host resolution — pure-logic proof (plain Node, no
 * framework, no DOM) for lib/site.ts's resolveSiteUrl(). This is the ONE
 * source of truth for metadataBase, canonical links, openGraph.url,
 * openGraph.images (via the file-based opengraph-image convention),
 * robots.txt, and sitemap.xml — so a regression here silently corrupts
 * every public metadata surface at once. These assertions lock in the
 * two rules the flagged audit turned on:
 *
 *   - No production metadata may ever carry the pre-pivot host
 *     "retargeting-mvp.vercel.app" (the value Vercel's auto-provided
 *     VERCEL_PROJECT_PRODUCTION_URL still resolves to, since it reflects
 *     the project's original name rather than the current alias).
 *   - No production metadata may ever carry a localhost URL.
 */
import assert from "node:assert/strict";
import { PRODUCTION_SITE_URL, resolveSiteUrl } from "../lib/site.ts";

const FORBIDDEN_IN_PUBLIC_METADATA = ["retargeting-mvp", "localhost"];

/* ---- The known-correct production URL is the one the audit specified. ---- */
{
  assert.equal(PRODUCTION_SITE_URL, "https://creative-debrief.vercel.app");
}

/* ---- Priority 1: NEXT_PUBLIC_SITE_URL override wins over everything. ---- */
{
  const url = resolveSiteUrl({
    NEXT_PUBLIC_SITE_URL: "https://debrief.example.com",
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "retargeting-mvp.vercel.app",
    VERCEL_URL: "whatever.vercel.app",
  });
  assert.equal(url, "https://debrief.example.com", "explicit override must win");
}

/* ---- Priority 2: production resolves to the fixed correct alias, and
        NEVER to the stale retargeting-mvp host, even when Vercel's own
        VERCEL_PROJECT_PRODUCTION_URL still reports the old name. ---- */
{
  const url = resolveSiteUrl({
    VERCEL_ENV: "production",
    VERCEL_PROJECT_PRODUCTION_URL: "retargeting-mvp.vercel.app",
    VERCEL_URL: "retargeting-mvp-abc123.vercel.app",
  });
  assert.equal(url, "https://creative-debrief.vercel.app", "production must use the fixed alias");
  for (const bad of FORBIDDEN_IN_PUBLIC_METADATA) {
    assert.ok(!url.includes(bad), `production URL must never contain "${bad}" (got ${url})`);
  }
}

/* ---- Priority 3: a preview (non-production) deployment points at its
        own preview URL, so preview OG cards unfurl the preview itself. ---- */
{
  const url = resolveSiteUrl({
    VERCEL_ENV: "preview",
    VERCEL_URL: "creative-debrief-git-feature-someuser.vercel.app",
  });
  assert.equal(url, "https://creative-debrief-git-feature-someuser.vercel.app");
}

/* ---- Priority 4: local dev only — the ONLY path that yields localhost,
        and it is unreachable once any Vercel env var is present. ---- */
{
  assert.equal(resolveSiteUrl({}), "http://localhost:3000", "bare local dev falls back to localhost");
}

/* ---- Contract guard: localhost can ONLY ever come from the bare-local
        path — never from a production or preview environment. ---- */
{
  const productionish = resolveSiteUrl({ VERCEL_ENV: "production" });
  assert.ok(!productionish.includes("localhost"), "production must never yield localhost");

  const previewish = resolveSiteUrl({ VERCEL_ENV: "preview", VERCEL_URL: "x.vercel.app" });
  assert.ok(!previewish.includes("localhost"), "preview must never yield localhost");
}

console.log("site: all metadata host-resolution proofs passed");
