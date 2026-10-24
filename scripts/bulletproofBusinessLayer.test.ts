/**
 * Bulletproof pass A1 — performance vs business decision.
 *
 * Layer 1 (unchanged) places each ad above / near / below the median;
 * Layer 2 crosses that with the user's breakeven (target ROAS / CPA):
 * Scale candidate · Above average, not profitable — don't scale ·
 * Maintain (reduce, don't pause) · Reduce candidate · Wait (above the
 * median on too few purchases) · Hold (near / at the median). Without a
 * breakeven the statuses say "(profitability unknown)" and the Next move
 * says the move is relative to the account. With one, an ad under it
 * can't receive budget (listed as the user's bar); if that leaves no
 * receiver the copy names the breakeven, never the receiver floor. The
 * generator shows the breakeven next to the KPI, never required.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const dated = (header: string, rows: string[]) =>
  `${header},Reporting starts,Reporting ends\n` + rows.map((r) => `${r},2026-06-01,2026-06-30`).join("\n") + "\n";
const H = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value";
// Median 3.0x. A 5.0 (40) · C 4.5 (5 purchases) · B 3.8 · M1–M3 3.0 ·
// D 2.8 (−7%, near) · E 2.0 · F 1.2.
const ROWS = ["A,600,40,3000", "B,600,36,2280", "C,400,5,1800", "M1,400,15,1200", "M2,400,15,1200", "M3,400,15,1200", "D,400,15,1120", "E,400,10,800", "F,400,6,480"];
const CSV = dated(H, ROWS);

const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  const statusOf = (memo: ReturnType<typeof run>["memo"]) =>
    Object.fromEntries(
      [...memo.winners, ...(memo.atMedian?.rows ?? []), ...memo.losers.rows].map((r) => [r.name, r.status?.buyer])
    );

  /* ---- No breakeven: relative statuses, and the move says so ---- */
  const none = run(CSV, "roas");
  assert.equal(none.analysis.median, 3);
  assert.deepEqual(statusOf(none.memo), {
    A: "Scale candidate (profitability unknown)",
    B: "Above average — keep",
    C: "Wait — 5 purchases, not enough evidence to scale",
    M1: "Hold — near median", M2: "Hold — near median", M3: "Hold — near median",
    D: "Hold — near median",
    E: "Reduce candidate (profitability unknown)",
    F: "Reduce candidate (profitability unknown)",
  });
  assert.equal(none.memo.decision.action, "budget");
  assert.deepEqual(none.memo.decision.budgetMove!.to.map((x) => x.name), ["A"]);
  assert.equal(
    none.memo.decision.profitBasisNote?.buyer,
    "This move is relative to the account (each ad vs the median), not profit-based. Set a target ROAS (your breakeven) for a profit-based trim list."
  );
  assert.ok(none.buyerText.includes(none.memo.decision.profitBasisNote!.buyer));
  assert.ok(none.buyerText.includes("- A | 5.00x"), "TXT row");
  assert.match(none.buyerText, /- A \| 5\.00x[^\n]* \| Scale candidate \(profitability unknown\)\n/, "status ends the TXT row");

  /* ---- Breakeven 4.0: the full matrix ---- */
  const b4 = run(CSV, "roas", { targetRoas: 4 });
  assert.deepEqual(statusOf(b4.memo), {
    A: "Scale candidate",
    B: "Above average, not profitable — don't scale",
    C: "Wait — 5 purchases, not enough evidence to scale",
    M1: "Hold — near median", M2: "Hold — near median", M3: "Hold — near median",
    D: "Hold — near median",
    E: "Reduce candidate",
    F: "Reduce candidate",
  });
  assert.equal(b4.memo.decision.profitBasisNote, undefined, "profit-based now");
  assert.ok(b4.memo.decision.appliedCriteria.some((c) => c.label === "Breakeven: 4.00x ROAS — an ad must beat it to receive budget — your criterion" && c.source === "user"));

  /* ---- Breakeven 1.8: below the median but still profitable ⇒ Maintain ---- */
  const b18 = run(CSV, "roas", { targetRoas: 1.8 });
  assert.equal(statusOf(b18.memo).E, "Maintain (reduce, don't pause)");
  assert.equal(statusOf(b18.memo).F, "Reduce candidate");

  /* ---- A breakeven above every candidate: no receiver, and the copy says why ---- */
  const b55 = run(CSV, "roas", { targetRoas: 5.5 });
  assert.equal(statusOf(b55.memo).A, "Above average, not profitable — don't scale");
  assert.equal(b55.memo.decision.budgetVariant, "cut", "nothing profitable to scale ⇒ trim only");
  assert.match(b55.memo.decision.rationale, /every ad past the 30% bar is under your breakeven \(5\.50x\), so the move is trimming the leak, not scaling\./);
  assert.ok(!b55.memo.decision.rationale.includes("receiver floor"), "never blames the floor for a breakeven exclusion");
  assert.ok(b55.memo.decision.limits.buyer.includes("1 ad past the 30% bar is under your breakeven (5.50x) — above average, not profitable — and doesn't receive budget."));

  /* ---- CPA: target CPA is the breakeven, lower is better ---- */
  const cpa = run(
    dated("Ad name,Amount spent (EUR),Purchases,Cost per purchase (EUR)", ["A,400,40,10", "B,400,36,11.11", "C,400,33,12.12", "D,400,30,13.33", "E,400,28,14.29", "F,400,20,20", "G,400,10,40"]),
    "cpa",
    { targetCpa: 25 }
  ).memo;
  assert.equal(statusOf(cpa).F, "Maintain (reduce, don't pause)", "$20 beats a $25 target");
  assert.equal(statusOf(cpa).G, "Reduce candidate");

  /* ---- A-fix 1: "Scale candidate" ⇔ the ad receives budget ---- */
  {
    const fixture = (f: string) => readFileSync(join(ROOT, "scripts/fixtures", f), "utf8");
    const memos = [
      none.memo, b4.memo, b18.memo, b55.memo, cpa,
      run(fixture("agency-naming-convention.csv"), "roas").memo,
      run(fixture("agency-naming-convention.csv"), "roas", { targetRoas: 3.5 }).memo,
      run(fixture("ecom-13ads.csv"), "roas").memo,
      run(fixture("ecom-13ads.csv"), "ctr").memo, // proxy KPI: no budget move ⇒ no scale candidate
      run(fixture("tester-cpa-8ads.csv"), "cpa").memo,
      buildSampleMemo(),
    ];
    for (const memo of memos) {
      const rows = [...memo.winners, ...(memo.atMedian?.rows ?? []), ...memo.losers.rows];
      const scale = rows.filter((r) => r.status?.key === "scale").map((r) => r.name).sort();
      const receivers = (memo.decision.budgetMove?.to ?? []).map((t) => t.name).sort();
      assert.deepEqual(scale, receivers, `scale candidates = receivers (${memo.decision.headline})`);
      for (const line of memo.avoid.buyer.filter((l) => l.startsWith("Do not scale anything except")))
        assert.ok(line.includes(scale.length === 1 ? "the scale candidate" : `the ${scale.length} scale candidates`), "never a scale candidate the report says not to scale");
    }
    // Past the 30% bar with enough purchases but outside the top 3 ⇒ keep.
    const many = run(dated(H, ["A,600,40,3000", "B,600,38,2850", "C,600,36,2700", "D,600,34,2550", ...ROWS.slice(3)]), "roas").memo;
    assert.equal(many.decision.budgetMove?.to.length, 3);
    assert.equal(many.winners.filter((r) => r.status?.key === "scale").length, 3);
    assert.ok(many.winners.some((r) => r.status?.buyer === "Above average — keep"), "a 4th qualifying ad keeps its budget");
  }

  /* ---- Client register: plain words ---- */
  for (const memo of [none.memo, b4.memo, b55.memo]) {
    const strings = [...clientStrings(memo), ...[...memo.winners, ...memo.losers.rows].map((r) => r.status?.client ?? "")];
    for (const s of strings) for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);
  }
  assert.equal(none.memo.winners.find((r) => r.name === "A")?.status?.client, "Candidate for more budget (break-even not set)");

  /* ---- Generator: the breakeven sits next to the KPI, never required ---- */
  const panel = readFileSync(join(ROOT, "components/debrief/GeneratorPanel.tsx"), "utf8");
  const near = panel.slice(panel.indexOf("Bulletproof pass A1 — the breakeven sits next to the KPI"), panel.indexOf("Input Honesty V1: one compact"));
  assert.match(near, /\{fields\.kpi === "roas" \? "Breakeven ROAS" : "Target CPA"\}\s*<span className="ml-1 font-normal text-zinc-400">\(recommended\)<\/span>/);
  assert.ok(!/required/.test(near.replace(/never required/g, "")), "never required");
  assert.ok(panel.indexOf("Bulletproof pass A1 — the breakeven") < panel.indexOf("Refine analysis"), "visible by default, outside Refine");
  assert.match(panel, /\{fields\.kpi !== "roas" && \(\s*<div>\s*<label htmlFor="targetRoas"/, "Refine keeps only the other target");
  assert.match(panel, /\{fields\.kpi !== "cpa" && \(\s*<div>\s*<label htmlFor="targetCpa"/);

  /* ---- Report renders the status and the relative-move line ---- */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /function StatusLine\(/);
  assert.match(report, /\{client \? d\.profitBasisNote\.client : d\.profitBasisNote\.buyer\}/);

  console.log("bulletproof business layer: all assertions passed");
} finally {
  cleanup();
}
