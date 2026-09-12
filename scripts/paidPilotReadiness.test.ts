/**
 * Paid Pilot Readiness V1 — source-scan proofs, mirroring the
 * established pattern in scripts/homepagePositioning.test.ts and
 * scripts/decisionQueueCommercialSurfaces.test.ts (this codebase has
 * no component-render harness — see CLAUDE.md).
 *
 * Covers the three copy/nav fixes from this milestone: the Decision
 * Queue disclosure on Privacy + Security, the Ad Library / OAuth
 * distinction on Privacy, and the marketing footer's missing Founding
 * link. The fourth fix (next.config.ts headers) has its own proof in
 * scripts/securityHeaders.test.ts; the fifth (the focus-ring swap) is
 * a one-line class-name change with no behavioral branch to test.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

/* ===================== Privacy: Decision Queue disclosure ===================== */
{
  const src = readFileSync(join(ROOT, "app/(workspace)/privacy/page.tsx"), "utf8");

  assert.match(src, /Decision Queue/, "privacy: Decision Queue is named");
  assert.match(
    src,
    /ad names, spend, and KPI values/,
    "privacy: discloses what a queued report can contain"
  );
  assert.match(
    src,
    /nothing about it touches localStorage, cookies, or our servers/,
    "privacy: explicitly rules out the three persistence mechanisms the product actually has"
  );
  assert.match(
    src,
    /refreshing the page or closing the tab erases the CSV, every report, and the queue together/,
    "privacy: the corrected claim covers the CSV, every queued report, AND the queue as one unit"
  );

  // The old, now-inaccurate claim must be gone — it read as though
  // nothing survives within a session, which stopped being true the
  // moment Decision Queue could hold multiple accounts' reports.
  assert.ok(
    !src.includes("nothing to look back at, because nothing is kept"),
    "privacy: the stale 'nothing to look back at' claim must not survive"
  );

  console.log("paidPilotReadiness: privacy page — Decision Queue disclosure present, stale claim removed");
}

/* ===================== Privacy: Ad Library / OAuth distinction ===================== */
{
  const src = readFileSync(join(ROOT, "app/(workspace)/privacy/page.tsx"), "utf8");

  const adLibraryStart = src.indexOf("Competitor ads from Meta's Ad Library");
  const metaAffiliationStart = src.indexOf("Meta affiliation");
  assert.ok(adLibraryStart > 0 && metaAffiliationStart > adLibraryStart, "privacy: both Meta sections found, in order");
  const adLibrarySection = src.slice(adLibraryStart, metaAffiliationStart);

  assert.match(
    adLibrarySection,
    /separate integration from the optional ads_read Meta connection/,
    "privacy: the Ad Library section explicitly distinguishes itself from the OAuth ads_read connection"
  );
  assert.match(
    adLibrarySection,
    /the two never share data or a token/,
    "privacy: explicitly states the two Meta integrations are data/token-isolated"
  );

  console.log("paidPilotReadiness: privacy page — Ad Library vs. OAuth distinction present");
}

/* ===================== Security: Decision Queue disclosure ===================== */
{
  const src = readFileSync(join(ROOT, "app/(workspace)/security/page.tsx"), "utf8");

  assert.match(src, /Decision Queue/, "security: Decision Queue is named");
  assert.match(
    src,
    /ad names, spend, and KPI values/,
    "security: discloses what a queued report can contain"
  );
  assert.match(
    src,
    /none of it is written to a database, a file, a cache, or a log/,
    "security: reaffirms no server-side persistence for queued reports"
  );
  assert.match(
    src,
    /refreshing the page erases the CSV, every report, and the queue together/,
    "security: the corrected claim covers the CSV, every report, AND the queue as one unit"
  );

  assert.ok(
    !src.includes("nothing kept to look back at"),
    "security: the stale 'nothing kept to look back at' claim must not survive"
  );

  console.log("paidPilotReadiness: security page — Decision Queue disclosure present, stale claim removed");
}

/* ===================== Marketing footer: Founding link ===================== */
{
  const src = readFileSync(join(ROOT, "app/(marketing)/layout.tsx"), "utf8");
  assert.match(
    src,
    /<Link href="\/founding"[^>]*>\s*Founding\s*<\/Link>/,
    "marketing footer: Founding link present, matching the workspace footer"
  );

  // Ordering: Founding sits right after Pricing, matching the
  // workspace footer's own Pricing -> Founding -> About order — a nav
  // consistency fix, not a reordering of the existing links.
  const pricingIdx = src.indexOf('href="/pricing"');
  const foundingIdx = src.indexOf('href="/founding"');
  const aboutIdx = src.indexOf('href="/about"');
  assert.ok(
    pricingIdx < foundingIdx && foundingIdx < aboutIdx,
    "marketing footer: Founding sits between Pricing and About, matching the workspace footer's order"
  );
}
{
  // Cross-check against the workspace footer so the two never drift
  // out of the same link set again without a visible test failure.
  const workspaceSrc = readFileSync(join(ROOT, "app/(workspace)/layout.tsx"), "utf8");
  assert.match(workspaceSrc, /href="\/founding"/, "workspace footer still has Founding (unchanged by this milestone)");
  console.log("paidPilotReadiness: marketing footer — Founding link added, ordered consistently with the workspace footer");
}

console.log("paidPilotReadiness: all assertions passed");
