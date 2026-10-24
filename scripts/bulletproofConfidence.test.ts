/**
 * Bulletproof pass A2 — two confidence labels.
 *
 * "Evidence" is today's read: how clearly the data separates the ads.
 * "Decision" is how safe the action is: the same level, capped at medium
 * when profitability is unknown (no breakeven / target) and when funnel
 * stages are mixed without per-stage medians — each cap named. Both show
 * in the buyer exec summary, the Next move card, the confidence section
 * and TXT; the client reads "How clear the results are" / "How safe the
 * next step is".
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const dated = (rows: string[], extra = "") =>
  `Ad name${extra ? `,${extra}` : ""},Amount spent (EUR),Purchases,Purchases conversion value,Reporting starts,Reporting ends\n` +
  rows.map((r) => `${r},2026-06-01,2026-06-30`).join("\n") + "\n";
const STRONG = ["R1,600,40,3000", "R2,600,36,2700", "R3,600,34,2520", "M1,400,15,1200", "M2,400,15,1200", "M3,400,15,1200", "M4,400,15,1200", "M5,400,15,1200", "L1,400,10,600", "L2,400,10,600", "L3,400,10,600", "L4,400,10,600"];

const { run, cleanup } = loadEngine();
try {
  /* ---- Supported evidence, no breakeven ⇒ decision capped at medium ---- */
  const none = run(dated(STRONG), "roas");
  assert.equal(none.memo.confidence.level, "high", "evidence");
  assert.deepEqual(none.memo.confidence.decision, {
    level: "medium",
    caps: { buyer: ["profitability unknown — no breakeven set"], client: ["your break-even point isn't set"] },
  });
  assert.ok(none.buyerText.includes("CONFIDENCE — EVIDENCE: HIGH · DECISION: MEDIUM"));
  assert.ok(none.buyerText.includes("Decision: Medium — profitability unknown — no breakeven set"));
  assert.ok(none.buyerText.includes("\nEvidence: Strong support from this dataset"), "card evidence line");
  assert.ok(none.clientText.includes("How clear the results are: HIGH."));
  assert.ok(none.clientText.includes("How safe the next step is: Medium — your break-even point isn't set"));

  /* ---- With a breakeven (every receiver beats it) ⇒ decision follows evidence ---- */
  const be = run(dated(STRONG), "roas", { targetRoas: 2 });
  assert.equal(be.memo.confidence.level, "high");
  assert.deepEqual(be.memo.confidence.decision, { level: "high", caps: { buyer: [], client: [] } });
  assert.ok(be.buyerText.includes("Decision: High\n"));

  /* ---- Mixed stages with no per-stage split possible ⇒ capped, named ---- */
  // 4 TOFU + 4 BOFU (both under the 5-ad stage minimum) + 4 unstaged.
  const staged = STRONG.map((r, i) => {
    const [n, ...rest] = r.split(",");
    return [i % 3 === 0 ? `${n}_TOFU` : i % 3 === 1 ? `${n}_BOFU` : n, ...rest].join(",");
  });
  const mixed = run(dated(staged), "roas", { targetRoas: 2 });
  assert.ok(mixed.analysis.funnelMix, "stages detected");
  assert.equal(mixed.memo.confidence.decision.level, mixed.memo.confidence.level === "high" ? "medium" : mixed.memo.confidence.level);
  assert.deepEqual(mixed.memo.confidence.decision.caps.buyer, ["funnel stages are mixed and judged against one median"]);

  /* ---- Evidence below high is never raised; caps still named ---- */
  const thin = run(dated(["A,400,20,1600", "B,400,20,1200", "C,400,20,1220", "D,400,20,1000", "E,400,18,900"]), "roas");
  assert.notEqual(thin.memo.confidence.level, "high");
  assert.equal(thin.memo.confidence.decision.level, thin.memo.confidence.level);

  /* ---- Client wording ---- */
  for (const s of [...clientStrings(none.memo), ...none.memo.confidence.decision.caps.client])
    for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);

  /* ---- Report: both labels in the exec summary, card and confidence section ---- */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /\{ label: "Evidence", value: memo\.confidence\.level \},\s*\{ label: "Decision", value: decisionLine\(memo\.confidence, "buyer"\) \},/);
  assert.ok(!report.includes('{ label: "Confidence", value: memo.confidence.level }'), "the single label is gone");
  assert.match(report, /\{CONFIDENCE_LABELS\.decision\[client \? "client" : "buyer"\]\}/, "card");
  assert.match(report, /\{client \? "Next step" : "Decision"\} \{memo\.confidence\.decision\.level\}/, "section badge");
  const text = readFileSync(join(ROOT, "components/debrief/memoToText.ts"), "utf8");
  assert.match(text, /evidence: \{ buyer: "Evidence", client: "How clear the results are" \},\s*decision: \{ buyer: "Decision", client: "How safe the next step is" \},/);

  console.log("bulletproof confidence: all assertions passed");
} finally {
  cleanup();
}
