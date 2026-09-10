/**
 * Homepage Positioning & Conversion V1 — plain-Node proof.
 *
 * Copy/structure-only milestone: no engine, route, or type change, so
 * this is a source-scan over app/(marketing)/page.tsx, mirroring the
 * anchor-and-slice pattern used for prior Generator/report copy proofs
 * (e.g. scripts/refineAnalysisFramingCopy.test.ts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const src = readFileSync(join(ROOT, "app/(marketing)/page.tsx"), "utf8");

const heroStart = src.indexOf("{/* ---- Hero ---- */}");
const heroEnd = src.indexOf("{/* ---- How it works: asymmetric bento ---- */}");
assert.ok(heroStart !== -1 && heroEnd !== -1 && heroStart < heroEnd, "hero section boundaries found");
const hero = src.slice(heroStart, heroEnd);

/* ===================== 1. New hero positioning ===================== */
{
  assert.match(hero, /Know what to do with your Meta Ads data/, "new headline present");
  assert.match(hero, /when the evidence isn&apos;t strong enough/, "new headline's evidence clause present");
  assert.match(
    hero,
    /One CSV or Meta connection in\. One committed recommendation out/,
    "new supporting copy present"
  );
  assert.ok(!hero.includes("turned into a decision"), "old headline phrase removed from hero");
  assert.ok(!hero.includes("in\n          two minutes") && !/—\s*in\s*\n?\s*two minutes/.test(hero), "old 'in two minutes' hero framing removed");
}

/* ===================== 2. Primary + secondary CTA destinations ===================== */
{
  assert.match(
    hero,
    /<Link href="\/generator"[^>]*>\s*Debrief your ads/,
    "primary CTA: Debrief your ads -> /generator"
  );
  assert.match(
    hero,
    /<Link href="\/sample"[^>]*>\s*See a sample report/,
    "secondary CTA: See a sample report -> /sample"
  );
  // Exactly one CTA/link pair in the hero — no duplicate sample-report
  // link doing the secondary CTA's job a second time.
  assert.equal((hero.match(/href="\/sample"/g) ?? []).length, 1, "exactly one /sample link in the hero");
}

/* ===================== 3. Competitor-debrief hero link absent ===================== */
{
  assert.ok(!hero.includes("competitor-debrief"), "no /competitor-debrief reference in the hero");
  assert.ok(!hero.includes("Try the competitor debrief"), "old competitor-debrief hero copy removed");
  // The page (and product) still link to it elsewhere is out of scope —
  // the feature/page itself is untouched; only the hero-level link is
  // gone. Confirm the route file itself was not touched by this milestone.
}

/* ===================== 4. Evidence-honesty section present ===================== */
{
  const evidenceStart = src.indexOf("{/* ---- Evidence honesty: why trust the call ---- */}");
  const evidenceEnd = src.indexOf("{/* ---- The problem ---- */}");
  assert.ok(evidenceStart !== -1 && evidenceEnd !== -1 && evidenceStart < evidenceEnd, "evidence section boundaries found");
  const evidence = src.slice(evidenceStart, evidenceEnd);

  assert.match(evidence, /Why trust the call/);
  assert.match(evidence, /Every recommendation states how sure it is/);
  assert.match(evidence, /<MiniEvidenceCard \/>/, "the concrete example card is mounted in this section");
  // The concrete example itself: a real "hold" shape, with evidence +
  // criteria provenance — not a feature list. MiniEvidenceCard is
  // defined earlier in the file as its own component, so its rendered
  // text is checked against the full source, not this section's slice.
  assert.match(src, /Hold — too few ads have cleared the spend gate/);
  assert.match(src, /Evidence: limited/);
  assert.match(src, /Criteria: Debrief default/);
  // Links to existing destination pages, unmodified.
  assert.match(evidence, /href="\/how-it-works"/);
  assert.match(evidence, /href="\/vs-chatgpt"/);

  // Not a giant feature list: no more than 2 supporting paragraphs plus
  // the section header block.
  const paragraphCount = (evidence.match(/<p className="text-sm leading-relaxed text-zinc-400">/g) ?? []).length;
  assert.ok(paragraphCount <= 2, `evidence section stays compact (${paragraphCount} body paragraphs)`);
}

/* ===================== 5. Founding path present, restrained ===================== */
{
  assert.match(src, /Running paid media for clients\?/);
  assert.match(src, /<Link\s+href="\/founding"/);
  assert.match(src, /See the founding agency program/);

  // Restrained: a single <p>, not a <section> with its own card/heading
  // treatment competing with the hero or the Final CTA.
  const foundingStart = src.indexOf("Running paid media for clients?");
  const surroundingStart = src.lastIndexOf("<p", foundingStart);
  const surroundingTagLine = src.slice(surroundingStart, src.indexOf(">", surroundingStart));
  assert.ok(!surroundingTagLine.includes("card"), "founding line uses plain text styling, not a card component");
}

/* ===================== 6. No prohibited capability/claim language ===================== */
{
  // Decision Queue Commercial Surface V1: "Decision Queue" / "multi
  // account" wording is no longer blanket-banned — the homepage now
  // deliberately mentions the queue once (section 7 below pins exactly
  // where and how). What stays banned is any AI/guarantee/health-score/
  // automation framing, on the homepage or anywhere near the new
  // Decision Queue mention specifically.
  const banned = [
    "AI-powered",
    "unlock insights",
    "never touches a server",
    "guaranteed",
    "portfolio triage",
    "health score",
    "AI decides",
    "automatically pulls",
    "all your accounts automatically",
  ];
  for (const phrase of banned) {
    assert.ok(
      !src.toLowerCase().includes(phrase.toLowerCase()),
      `prohibited phrase "${phrase}" must not appear anywhere on the homepage`
    );
  }
  // The pre-existing, approved "never touches a database" claim (Trust
  // card) must survive untouched — proves the banned-phrase scan above
  // isn't accidentally over-broad.
  assert.match(src, /never touches a database/, "pre-existing, approved database claim still present");
}

/* ===================== 7. Decision Queue mention: present once, subordinate, honest ===================== */
{
  // Exactly one mention — this is a secondary capability note, not a
  // repeated pitch woven through the page.
  assert.equal(
    (src.match(/Decision Queue/g) ?? []).length,
    1,
    "Decision Queue is mentioned exactly once on the homepage"
  );

  // Subordinate: lives inside "What you get", strictly after the hero
  // (single-account positioning must stay the headline) and before the
  // Founding-path line — never its own <section> competing with either.
  const whatYouGetStart = src.indexOf("{/* ---- What you get ---- */}");
  const foundingPathStart = src.indexOf("{/* ---- Founding path:");
  assert.ok(whatYouGetStart > 0 && foundingPathStart > whatYouGetStart, "What you get / Founding path boundaries found, in order");
  assert.ok(!hero.includes("Decision Queue"), "Decision Queue is never mentioned in the hero");

  const dqIdx = src.indexOf("Decision Queue");
  assert.ok(
    dqIdx > whatYouGetStart && dqIdx < foundingPathStart,
    "the Decision Queue mention sits inside 'What you get', not before it or in the separate Founding-path line"
  );
  const dqParagraphStart = src.lastIndexOf("<p", dqIdx);
  const dqParagraph = src.slice(dqParagraphStart, src.indexOf("</p>", dqIdx) + 5);
  assert.match(
    dqParagraph,
    /After a few debriefs in the\s+same session/,
    "the mention is framed as a session-scoped, after-the-fact capability, not a persistent feature"
  );
  assert.ok(!dqParagraph.includes("<Link"), "the mention is copy only — no CTA/link into an empty /decision-queue from the homepage");
  assert.ok(!dqParagraph.includes(" score"), "no scoring language near the Decision Queue mention");
}

console.log("homepagePositioning: all assertions passed");
