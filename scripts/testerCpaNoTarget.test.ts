/**
 * Tester Feedback Fix 5 — CPA without a target is relative, not
 * profitability.
 *
 * With KPI = CPA (or lead-based CPA, read as cost per lead) and no
 * target CPA, ads are ranked against this account's own median — not
 * against what's profitable. One limits line says so in both
 * registers, and points at ROAS when the export carries ROAS / purchase
 * value. Copy only: the decision never reads it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, TESTER_CSV, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const BUYER =
  "No target CPA set — ads are ranked against this account's median CPA, not against what's profitable. A higher CPA isn't automatically worse if order value or margin differs.";
const ROAS_BUYER = " ROAS is available in this export and accounts for order value.";
const CLIENT =
  "No cost target was set, so ads are compared with this account's typical CPA, not with what's profitable. A higher CPA isn't automatically worse if order value or margin differs.";

const { run, cleanup } = loadEngine();
try {
  /* Tester export: CPA, no target, no ROAS/value columns. */
  const t = run(TESTER_CSV, "cpa");
  assert.deepEqual(t.analysis.cpaWithoutTarget, { roasAvailable: false });
  assert.equal(t.memo.decision.limits.buyer.filter((l) => l.startsWith("No target CPA set")).length, 1);
  assert.ok(t.memo.decision.limits.buyer.includes(BUYER));
  assert.ok(t.memo.decision.limits.client.includes(CLIENT));
  assert.ok(t.buyerText.includes(BUYER) && t.clientText.includes(CLIENT), "TXT carries it in both registers");
  for (const s of clientStrings(t.memo))
    for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);

  /* ROAS available → the extra sentence, both registers. */
  const [head, ...rows] = TESTER_CSV.trim().split("\n");
  const withValue = [`${head},Purchases conversion value (EUR)`, ...rows.map((r, i) => `${r},${(i + 1) * 100}`)].join("\n") + "\n";
  const v = run(withValue, "cpa");
  assert.deepEqual(v.analysis.cpaWithoutTarget, { roasAvailable: true });
  assert.ok(v.memo.decision.limits.buyer.includes(BUYER + ROAS_BUYER));
  assert.ok(v.memo.decision.limits.client.includes(CLIENT + " This file also includes return on ad spend, which accounts for order value."));
  assert.deepEqual(v.memo.decision.action, t.memo.decision.action, "copy only");

  /* Target set → no line. */
  const tc = run(TESTER_CSV, "cpa", { targetCpa: 20 });
  assert.equal(tc.analysis.cpaWithoutTarget, undefined);
  assert.ok(!tc.memo.decision.limits.buyer.some((l) => l.startsWith("No target CPA set")));

  /* Other KPIs → no line. */
  for (const kpi of ["roas", "purchases", "ctr", "cpc"]) {
    const o = run(withValue, kpi);
    assert.equal(o.analysis.cpaWithoutTarget, undefined, kpi);
  }

  /* Lead-based CPA reads as cost per lead, with a lead-appropriate caveat. */
  const leads = "Ad name,Amount spent (EUR),Leads,Cost per lead (EUR)\n" +
    Array.from({ length: 8 }, (_, i) => { const s = 150 + i * 45, l = 3 + ((i * 7) % 19); return `L_${i},${s},${l},${(s / l).toFixed(2)}`; }).join("\n") + "\n";
  const l = run(leads, "cpa");
  assert.equal(l.analysis.cpaBasis, "leads");
  assert.ok(l.memo.decision.limits.buyer.includes(
    "No target CPA set — ads are ranked against this account's median CPL, not against what's profitable. A higher CPL isn't automatically worse if lead quality or value differs."));
  assert.ok(l.memo.decision.limits.client.includes(
    "No cost target was set, so ads are compared with this account's typical cost per lead, not with what's profitable. A higher cost per lead isn't automatically worse if lead quality or value differs."));

  /* decision rules never branch on it (only buildLimits copy reads it). */
  const src = readFileSync(join(ROOT, "modules/debrief/decision.ts"), "utf8");
  assert.equal(src.match(/cpaWithoutTarget/g)?.length, 2, "read only inside the limits copy block");

  console.log("tester CPA without target: all assertions passed");
} finally {
  cleanup();
}
