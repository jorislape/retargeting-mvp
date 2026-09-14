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

function assertNoForbiddenClaims(src: string, surfaceName: string, phrases = FORBIDDEN_NEAR_DECISION_QUEUE) {
  for (const phrase of phrases) {
    assert.ok(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `${surfaceName}: prohibited phrase "${phrase}" must not appear anywhere on the page`
    );
  }
}

/** Launch Admin Surfaces V1 — claims that must never appear once the
 *  €149 Founding Pilot is a real, manually invoiced engagement: the
 *  old "payment isn't live yet" framing, any future hosted-checkout
 *  promise, and any phrasing that would present the paid pilot as
 *  UNLOCKING an existing, already-free capability (the software itself
 *  is not the thing being sold — see CLAUDE.md and the Launch Admin
 *  Surfaces V1 milestone). */
const FORBIDDEN_PAYMENT_CLAIMS = [
  "payment is not live",
  "payment isn't live",
  "not yet accepting payment",
  "hosted payment links will be added",
  "hosted payment link",
  "no payment system",
  "unlocks decision queue",
  "unlock the decision queue",
  "unlocks white-label",
  "unlock white-label",
  "unlocks creative groups",
  "unlock creative groups",
  "unlocks the software",
  "unlock the software",
];

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
  assertNoForbiddenClaims(src, "founding", FORBIDDEN_PAYMENT_CLAIMS);
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
  assertNoForbiddenClaims(src, "pricing", FORBIDDEN_PAYMENT_CLAIMS);
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

/* ===================== Launch Admin Surfaces V1: €149 Founding Pilot payment copy ===================== */
{
  const foundingSrc = readFileSync(join(ROOT, "app/(workspace)/founding/page.tsx"), "utf8");
  const pricingSrc = readFileSync(join(ROOT, "app/(workspace)/pricing/page.tsx"), "utf8");

  // The free-software promise (pre-existing, untouched by this
  // milestone) must survive on both pages — this is what keeps the
  // €149 pilot from ever reading as a software unlock.
  assert.match(
    foundingSrc,
    /stays free and unlimited for everyone, whether or not you join the founding program/,
    "founding: the pre-existing 'free tool stays free' FAQ answer is unchanged"
  );
  assert.match(
    pricingSrc,
    /Debrief&rsquo;s software stays free to use right now/,
    "pricing: the corrected header paragraph opens by reaffirming the software is free"
  );

  // Founding FAQ: payment is live, priced, timeboxed, and manually
  // invoiced — no bare "not yet" and no future hosted-checkout promise.
  const paymentFaqStart = foundingSrc.indexOf('q: "Is payment live today?"');
  assert.ok(paymentFaqStart > 0, "founding: 'Is payment live today?' FAQ entry found");
  const paymentFaqEnd = foundingSrc.indexOf("},", paymentFaqStart);
  const paymentFaqAnswer = foundingSrc.slice(paymentFaqStart, paymentFaqEnd);
  assert.match(paymentFaqAnswer, /€149/, "founding: payment FAQ states the €149 price");
  assert.match(paymentFaqAnswer, /30 days/, "founding: payment FAQ states the 30-day term");
  assert.match(paymentFaqAnswer, /invoice/i, "founding: payment FAQ states manual invoicing");
  assert.match(paymentFaqAnswer, /no auto-renewal/i, "founding: payment FAQ states no auto-renewal");
  assert.match(paymentFaqAnswer, /software itself stays free/, "founding: payment FAQ reaffirms the software stays free");
  assert.ok(!paymentFaqAnswer.toLowerCase().includes("not yet"), "founding: payment FAQ no longer says payment isn't live");

  // The paid pilot must never be framed as unlocking an existing free
  // capability — none of these belong inside the payment answer.
  for (const feature of ["Decision Queue", "white-label", "Creative Group", "Client report"]) {
    assert.ok(
      !paymentFaqAnswer.includes(feature),
      `founding: payment FAQ must not present the pilot as unlocking "${feature}"`
    );
  }

  // Pricing header: price, term, manual/invoice mechanics, and a link
  // to /founding — kept OUT of the Free/Team tier definitions so the
  // pilot never reads as a third software tier.
  const headerEnd = pricingSrc.indexOf("</header>");
  const header = pricingSrc.slice(0, headerEnd);
  assert.match(header, /€149/, "pricing: header paragraph states the €149 price");
  assert.match(header, /30-Day Founding Pilot/, "pricing: header paragraph names the Founding Pilot by its exact name");
  assert.match(header, /manually arranged/, "pricing: header paragraph states the pilot is manually arranged");
  assert.match(header, /invoiced/, "pricing: header paragraph states invoicing, not self-serve checkout");
  assert.match(header, /href="\/founding"/, "pricing: header paragraph links to /founding for details");
  assert.match(header, /self-serve billing/, "pricing: reaffirms no self-serve billing exists, distinct from the manual pilot");

  const freeTierStart = pricingSrc.indexOf('name: "Free"');
  const teamTierStart = pricingSrc.indexOf('name: "Team"');
  const tiersBlock = pricingSrc.slice(freeTierStart, pricingSrc.indexOf("] as const", teamTierStart));
  assert.ok(!tiersBlock.includes("149"), "pricing: the €149 price never appears inside the Free/Team tier definitions — Founding is not a software tier");
  assert.ok(!tiersBlock.includes("Founding Pilot"), "pricing: the Founding Pilot is never listed as a tier point");

  console.log("decisionQueueCommercialSurfaces: Launch Admin Surfaces V1 — €149 Founding Pilot payment copy is live, priced, timeboxed, manually invoiced, and never framed as a software unlock");
}

console.log("decisionQueueCommercialSurfaces: all assertions passed");
