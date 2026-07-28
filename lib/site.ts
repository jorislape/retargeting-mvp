/**
 * Resolves the canonical site URL used for metadataBase, canonical
 * links, robots.txt, and sitemap.xml — one source of truth so these can
 * never drift from each other or from what's actually deployed.
 *
 * Priority:
 *   1. NEXT_PUBLIC_SITE_URL — explicit override. Set this to the custom
 *      domain once one is attached; it wins over everything below and
 *      makes the rest of this function moot.
 *   2. Production (VERCEL_ENV === "production") — the fixed production
 *      URL constant below. Hardcoded ON PURPOSE: Vercel's auto-provided
 *      VERCEL_PROJECT_PRODUCTION_URL resolves to the project's ORIGINAL
 *      name (retargeting-mvp.vercel.app), NOT the current production
 *      alias (creative-debrief.vercel.app) — so trusting it leaked the
 *      wrong host into canonical/OG/sitemap/robots. Keep this constant in
 *      sync with the production alias, or set NEXT_PUBLIC_SITE_URL (a
 *      custom domain) and this stops mattering.
 *   3. VERCEL_URL — this deployment's own preview/branch URL, for
 *      non-production Vercel deployments (so preview OG cards point at
 *      the preview itself, not at production).
 *   4. http://localhost:3000 — local dev only. Never reached in a
 *      production Vercel deployment, so no localhost URL can appear in
 *      production metadata.
 */
export const PRODUCTION_SITE_URL = "https://creative-debrief.vercel.app";

/** Only the env keys this resolver reads. Deliberately narrower than
 *  NodeJS.ProcessEnv (which requires NODE_ENV) so the real process.env
 *  and small test env literals both satisfy it. */
type SiteEnv = Record<string, string | undefined>;

export function resolveSiteUrl(env: SiteEnv = process.env): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL;
  if (env.VERCEL_ENV === "production") return PRODUCTION_SITE_URL;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
