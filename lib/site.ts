/**
 * Resolves the canonical site URL used for metadataBase, canonical
 * links, robots.txt, and sitemap.xml — one source of truth so these can
 * never drift from each other or from what's actually deployed.
 *
 * Priority:
 *   1. NEXT_PUBLIC_SITE_URL — explicit override. Intentionally unset
 *      today (no custom domain is attached yet); set this once one is,
 *      and everything below stops mattering.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — Vercel's own stable production
 *      domain, auto-provided on every deployment with zero manual
 *      configuration. Reflects whatever the CURRENT production alias
 *      actually is (a custom domain once attached, the .vercel.app
 *      alias until then) — this is what keeps metadataBase correct in
 *      production without ever hardcoding a domain in source.
 *   3. VERCEL_URL — this deployment's own preview/branch URL, for
 *      non-production Vercel deployments (so preview OG cards point at
 *      the preview itself, not at production).
 *   4. http://localhost:3000 — local dev only.
 */
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
