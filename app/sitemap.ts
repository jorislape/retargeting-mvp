import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/*
 * Every route here is a real, public, no-auth page — nothing sensitive
 * is ever behind these (see the privacy scope fence in CLAUDE.md), so
 * there's no reason to exclude the tool pages alongside the marketing
 * ones. Kept as a flat, manually-maintained list rather than generated
 * from the filesystem — this repo has a small, stable set of routes by
 * design, and an explicit list is easier to audit than "whatever
 * exists under app/".
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "/", priority: 1 },
    { path: "/generator", priority: 0.9 },
    { path: "/competitor-debrief", priority: 0.8 },
    { path: "/how-it-works", priority: 0.7 },
    { path: "/sample", priority: 0.6 },
    { path: "/privacy", priority: 0.3 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    priority,
  }));
}
