/**
 * Decision Queue Commercial Surface V1 — source-scan proofs for the
 * founding, pricing, and how-it-works pages, mirroring the established
 * pattern in scripts/homepagePositioning.test.ts (this codebase has no
 * component-render harness — see CLAUDE.md).
 *
 * Decision Queue / Multi-Account V1 and its usability hardening are
 * real, shipped, session-scoped capabilities (modules/debrief/
 * decisionQueue.ts, app/(workspace)/decision-queue). This milestone is
 * positioning/discoverability only: these proofs exist to keep the
 * commercial copy honest about what that actually is — a pure
 * projection over already-completed Debriefs in the CURRENT session,
 * never persisted, never ranked by spend/business importance, never a
 * saved workspace, never monitoring, never automated ingestion.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

/** Claims that must never appear on any commercial surface, full stop
 *  — none of these three pages have a legitimate reason to use even a
 *  negated form of them. Shared across all three surfaces below so a
 *  future edit can't accidentally reintroduce one on just one page
 *  while a test only covers another. Deliberately NOT a bare
 *  "guaranteed" ban: the founding page already legitimately says "No
 *  guaranteed ROAS" (a negation disclaiming the claim, not making it)
 *  — matching this codebase's established pattern of checking for the
 *  AFFIRMATIVE claim, not the bare word. "health score" is checked
 *  separately below, since how-it-works legitimately uses it inside an
 *  approved negation ("never ranked by spend or a health score"). */
const FORBIDDEN_NEAR_DECISION_QUEUE = [
  "AI decides",
  "we guarantee",
  "all your accounts automatically",
  "automatically pulls",
  "automatically ingest",
  "saved workspace",
  "saves your accounts",
  "monitors your accounts",
  "monitoring your accounts",
  "alerts",
  "persistent queue",
  "team collaboration",
];

function assertNoForbiddenClaims(src: string, surfaceName: string) {
  for (const phrase of FORBIDDEN_NEAR_DECISION_QUEUE) {
    assert.ok(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${surfaceName}: prohibited phrase "${phrase}" must not appear anywhere on the page`
    );
  }
}

/** "health score" is banned outright on surfaces that have no reason
 *  to use it at all; on how-it-works it may appear exactly once, and
 *  only inside the approved negation this file's own How-it-works
 *  block asserts for below. */
function assertNoBareHealthScoreClaim(src: string, surfaceName: string) {
  assert.ok(
    !src.toLowerCase().includes("health score"),
    `${surfaceName}: "health score" must not appear anywhere on the page`
  );
}

/* ===================== Founding page ===================== */
{
  const src = readFileSync(join(ROOT, "app/(workspace)/founding/page.tsx"), "utf8");
  assertNoForbiddenClaims(src, "founding");
  assertNoBareHealthScoreClaim(src, "founding");

  assert.equal(
    (src.match(/Decision Queue/g) ?? []).length,
    1,
    "founding: Decision Queue mentioned exactly once"
  );
  assert.match(
    src,
    /"Session-scoped Decision Queue — triage several accounts in one sitting"/,
    "founding: the GET list item states session-scoped triage precisely"
  );

  // Sits in the GET array, positioned as a CURRENT capability (before
  // the future "structured learnings/workspace" item), not folded into
  // NOT_PROMISED or WHO_FOR.
  const getStart = src.indexOf("const GET = [");
  const getEnd = src.indexOf("] as const", getStart);
  const getBlock = src.slice(getStart, getEnd);
  assert.match(getBlock, /Session-scoped Decision Queue/, "founding: the mention lives inside the GET array");
  const dqPos = getBlock.indexOf("Session-scoped Decision Queue");
  const futureWorkspacePos = getBlock.indexOf("Early access to structured learnings/workspace");
  assert.ok(dqPos < futureWorkspacePos, "founding: the CURRENT Decision Queue item is listed before the FUTURE workspace item");

  console.log("decisionQueueCommercialSurfaces: founding page — one honest, session-scoped mention, correctly ordered before the future-workspace item");
}

/* ===================== Pricing page ===================== */
{
  const src = readFileSync(join(ROOT, "app/(workspace)/pricing/page.tsx"), "utf8");
  assertNoForbiddenClaims(src, "pricing");
  assertNoBareHealthScoreClaim(src, "pricing");

  assert.equal(
    (src.match(/Decision Queue/g) ?? []).length,
    1,
    "pricing: Decision Queue mentioned exactly once"
  );
  assert.match(
    src,
    /"Session-scoped Decision Queue to triage accounts you've debriefed"/,
    "pricing: the Free-tier point states session-scoped triage precisely"
  );

  // Must live under the FREE tier (it exists today), never under Team
  // (which is explicitly "Coming soon" / "Not built yet"), and must
  // read as clearly distinct from Team's "Planned: structured learnings
  // across accounts" — the two must never look like the same promise
  // at two different price points.
  const freeTierStart = src.indexOf('name: "Free"');
  const teamTierStart = src.indexOf('name: "Team"');
  assert.ok(freeTierStart > 0 && teamTierStart > freeTierStart, "pricing: Free tier precedes Team tier");
  const freeTierBlock = src.slice(freeTierStart, teamTierStart);
  assert.match(freeTierBlock, /Session-scoped Decision Queue/, "pricing: the Decision Queue point lives under the Free tier");
  const teamTierBlock = src.slice(teamTierStart);
  assert.ok(!teamTierBlock.includes("Decision Queue"), "pricing: Decision Queue is never listed under the Team tier (it's not a future/paid-only feature)");
  assert.match(teamTierBlock, /Planned: structured learnings across accounts/, "pricing: Team's own distinct future promise is untouched");

  console.log("decisionQueueCommercialSurfaces: pricing page — Decision Queue correctly placed under Free (available now), distinct from Team's future promise");
}

/* ===================== How it works page ===================== */
{
  const src = readFileSync(join(ROOT, "app/(workspace)/how-it-works/page.tsx"), "utf8");
  assertNoForbiddenClaims(src, "how-it-works");

  assert.equal(
    (src.match(/Decision Queue/g) ?? []).length,
    1,
    "how-it-works: Decision Queue mentioned exactly once"
  );

  // Lives inside the existing "Where this is going" roadmap-honesty
  // paragraph, framed as CURRENT (contrasted with the future learning
  // system described in the same paragraph) — not a new section.
  const roadmapStart = src.indexOf("{/* Roadmap honesty */}");
  assert.ok(roadmapStart > 0, "how-it-works: Roadmap honesty section found");
  const dqIdx = src.indexOf("Decision Queue");
  assert.ok(dqIdx > roadmapStart, "how-it-works: the mention lives inside the Roadmap honesty section");
  const roadmapParagraph = src.slice(src.lastIndexOf("<p", dqIdx), src.indexOf("</p>", dqIdx) + 5);
  assert.match(
    roadmapParagraph,
    /nothing stored between visits/,
    "how-it-works: the mention sits in the same paragraph as the existing statelessness claim, not a separate new claim"
  );
  assert.match(
    roadmapParagraph,
    /still nothing saved between visits/,
    "how-it-works: explicitly reaffirms no persistence right next to the Decision Queue mention"
  );
  assert.match(
    roadmapParagraph,
    /never ranked by spend or\s+a health score/,
    "how-it-works: explicitly disclaims spend/health-score ranking right next to the mention"
  );
  // The paragraph legitimately keeps its pre-existing link to
  // /security — only a NEW link into /decision-queue itself is what
  // must stay absent (consistent with the other two surfaces).
  assert.ok(!roadmapParagraph.includes('href="/decision-queue"'), "how-it-works: the mention itself is not a link into /decision-queue (consistent with the other surfaces)");

  // "health score" is only ever allowed inside the one approved
  // negation just asserted above — confirm it appears exactly once on
  // the whole page, so a future edit can't add a second, unguarded
  // (and possibly affirmative) use elsewhere.
  assert.equal(
    (src.match(/health score/gi) ?? []).length,
    1,
    "how-it-works: \"health score\" appears exactly once, only inside the approved negation"
  );

  console.log("decisionQueueCommercialSurfaces: how-it-works page — one honest mention inside the existing roadmap paragraph, persistence/ranking explicitly disclaimed");
}

console.log("decisionQueueCommercialSurfaces: all assertions passed");
