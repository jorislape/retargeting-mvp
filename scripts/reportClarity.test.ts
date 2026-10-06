/**
 * Report Clarity Pass — proofs.
 *
 * Wording only: "gate" never reaches the client register; the buyer
 * register defines the evidence gate once ("Minimum spend to judge
 * (evidence gate)") and says "minimum spend" afterwards; "past the
 * median" is gone; Brief readiness is explained in both registers;
 * buyer terms carry accessible tooltips; partial KPI-column matches get
 * the check-the-conversion hint. Numbers and the decision are untouched
 * (the sample's pinned decision is asserted here and in test:decision).
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { insightsToCsv } from "../modules/meta/insightsToCsv.ts";

const require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, "..");
const KPIS = ["roas", "cpa", "ctr", "cpc", "leads", "purchases"] as const;
const CLIENT_BANNED = ["kill", "gate", "benchmark", "median", "judged"];

/* Fixtures: the sample, a purchase export, a lead-gen export, a
   Results-only export, a Meta lead-gen pull, a CPA-with-zero-purchases
   export, and a too-thin (hold) export — covering budget, test, hold,
   no-value hold, and CPL wording paths. */
function fixtures(sampleCsv: string): Record<string, string> {
  const rows = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i)).join("\n") + "\n";
  const metaRows = Array.from({ length: 14 }, (_, i) => ({
    adName: `LeadAd_${i}`, spend: String(100 + i * 37), impressions: "9000", linkClicks: "120",
    ctr: "1.3", cpc: "0.9", purchases: "", purchaseValue: "", purchaseRoas: "", costPerPurchase: "",
    leads: String(3 + ((i * 7) % 25)), costPerLead: "", dateStart: "2026-08-01", dateStop: "2026-08-31",
    cpm: "11", addToCart: "", contentViews: "",
  }));
  return {
    sample: sampleCsv,
    purchase:
      "Ad name,Amount spent (EUR),Link clicks,Impressions,Purchases,Purchases conversion value,Purchase ROAS (return on ad spend),Cost per purchase (EUR)\n" +
      rows(14, (i) => { const s = 120 + i * 53, p = (i * 5) % 17, v = p * 48; return `Ad_${i},${s},${40 + i * 7},${s * 90},${p},${v},${(v / s).toFixed(2)},${p ? (s / p).toFixed(2) : ""}`; }),
    leads: "Ad name,Amount spent (EUR),Leads,Cost per lead (EUR)\n" +
      rows(12, (i) => { const s = 150 + i * 45, l = 3 + ((i * 7) % 19); return `L_${i},${s},${l},${(s / l).toFixed(2)}`; }),
    results: "Ad name,Amount spent (EUR),Results,Cost per result\n" +
      rows(12, (i) => { const s = 150 + i * 45, l = 3 + ((i * 7) % 19); return `R_${i},${s},${l},${(s / l).toFixed(2)}`; }),
    metaLeads: insightsToCsv(metaRows, "EUR"),
    cpaZero: "Ad name,Amount spent (USD),Purchases,Cost per purchase (USD)\n" +
      [["A", 400, 8], ["B", 380, 0], ["C", 360, 6], ["D", 340, 0], ["E", 320, 0], ["F", 300, 4], ["G", 280, 0], ["H", 260, 3], ["I", 50, 1]]
        .map(([n, s, p]) => `${n},${s},${p},${p ? ((s as number) / (p as number)).toFixed(2) : ""}`).join("\n") + "\n",
    hold: "Ad name,Amount spent (USD),Purchases,Purchases conversion value,Purchase ROAS (return on ad spend)\nA,900,20,2000,2.22\nB,800,10,900,1.12\nC,40,1,50,1.25\nD,30,0,0,0\nE,20,1,30,1.5\n",
  };
}

const dist = mkdtempSync(join(tmpdir(), "debrief-clarity-"));
try {
  execSync(
    `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
    { cwd: ROOT, stdio: "pipe" }
  );
  const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
  const { resolveColumns, kpiSourcePreview } = require(join(dist, "modules/debrief/columns.js"));
  const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
  const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
  const { generateMemo } = require(join(dist, "modules/debrief/memo.js"));
  const { buildSampleMemo } = require(join(dist, "modules/debrief/sample.js"));
  const { SAMPLE_CSV_TEXT } = require(join(dist, "modules/debrief/sampleCsv.js"));
  const { memoToText, clientizeText, CLIENT_BRIEF_LEGEND } = require(join(dist, "components/debrief/memoToText.js"));

  const run = (csv: string, kpi: string) => {
    const ctx = { kpi, product: "", offer: "", targetCpa: null, creativeNotes: "", marketContext: "" };
    const { headers, rows } = toTable(parseCsv(csv));
    const columns = resolveColumns(headers);
    const analysis = analyze(extractAds(rows, columns, kpi), rows, columns, ctx);
    return generateMemo(analysis, ctx);
  };
  type M = ReturnType<typeof run>;
  const clientStrings = (m: M) => {
    const d = m.decision;
    return [
      d.clientHeadline, d.clientRationale, ...d.avoidNow.client, d.reassess.client, ...d.limits.client,
      ...(m.clientSummary ?? []), ...(m.avoid?.client ?? []), m.confidence.clientWhy ?? "",
      ...m.nextTests.map((t: { briefReadiness?: { client: string } }) => t.briefReadiness?.client ?? ""),
    ].join("\n");
  };

  let runs = 0;
  for (const [name, csv] of Object.entries(fixtures(SAMPLE_CSV_TEXT))) {
    for (const kpi of KPIS) {
      let memo: M;
      try { memo = run(csv, kpi); } catch { continue; }
      runs++;
      const all = memo.nextTests.map((_: unknown, i: number) => i);
      const buyerText = memoToText(memo, "buyer", undefined, all);
      const clientText = memoToText(memo, "client", undefined, all);
      const label = `${name}/${kpi}`;

      // 1. No "gate" anywhere in client output; full client blocklist on
      //    the client-native strings.
      assert.ok(!/\bgate\b/i.test(clientText), `${label}: client text export has no "gate"`);
      const cs = clientStrings(memo).toLowerCase();
      for (const w of CLIENT_BANNED) assert.ok(!cs.includes(w), `${label}: client strings free of "${w}"`);

      // 1. Buyer: the first mention is the definition; later ones say "minimum spend".
      const first = buyerText.search(/minimum spend|evidence gate|spend gate/i);
      assert.ok(first >= 0, `${label}: buyer text mentions the minimum spend`);
      assert.match(buyerText.slice(first), /^Minimum spend to judge \(evidence gate\): /, `${label}: buyer first mention is the definition`);
      assert.equal((buyerText.match(/evidence gate/gi) ?? []).length, 1, `${label}: "evidence gate" appears exactly once (the definition)`);
      assert.ok(!/spend gate/i.test(buyerText), `${label}: no "spend gate" left in buyer text`);

      // 4. "past the median" gone; T3 "better than median vs median" gone.
      for (const t of [buyerText, clientText, JSON.stringify(memo)]) {
        assert.ok(!/past the median/.test(t), `${label}: no "past the median"`);
        assert.ok(!/than median vs|median vs median/.test(t), `${label}: no "…than median vs median"`);
      }

      // 2. Client brief readiness wording.
      if (memo.nextTests.some((t: { briefReadiness?: unknown }) => t.briefReadiness)) {
        assert.ok(clientText.includes(`Ready for a creative brief? ${CLIENT_BRIEF_LEGEND}`), `${label}: client legend present once`);
        assert.ok(!clientText.includes("Brief readiness:"), `${label}: client never says "Brief readiness"`);
        assert.ok(buyerText.includes("Brief readiness:"), `${label}: buyer keeps the label`);
      }
    }
  }
  assert.ok(runs >= 30, `exercised ${runs} fixture × KPI runs`);

  // Sample decision unchanged (same pins as test:decision).
  const sample = buildSampleMemo();
  assert.equal(sample.decision.action, "budget");
  assert.equal(sample.decision.budgetVariant, "shift");
  assert.equal(sample.decision.evidenceState, "supported");
  assert.equal(sample.scope.spendGateLabel, "$120.91");
  assert.match(sample.decision.rationale, /is 100% better than the median ROAS on \$428\.60/);
  assert.ok(
    sample.decision.appliedCriteria.some((c: { label: string }) => c.label.startsWith("Minimum spend to judge: $120.91 per ad")),
    "decision bars use the plain label"
  );

  // Client safety net: legacy and defining phrasings never reach the client.
  assert.equal(clientizeText("Minimum spend to judge (evidence gate): $5"), "Minimum spend to judge: $5");
  assert.equal(clientizeText("below the $5 spend gate"), "below the $5 minimum spend to judge");
  assert.ok(!/gate/i.test(clientizeText("the evidence gate and the gate")));

  // 5. Partial-match preview hint (Results keeps its own wording).
  assert.equal(
    kpiSourcePreview("leads", resolveColumns(["Ad name", "Amount spent (EUR)", "Qualified leads"])),
    "Leads from column 'Qualified leads' (check it's the conversion you mean)."
  );
  assert.equal(kpiSourcePreview("leads", resolveColumns(["Ad name", "Amount spent (EUR)", "Leads"])), "Leads from column 'Leads'.", "exact match: no hint");
  console.log(`reportClarity: ${runs} fixture × KPI runs — no client "gate", buyer first mention defined, no "past the median", no T3 doubling, brief wording`);
} finally {
  rmSync(dist, { recursive: true, force: true });
}

/* ===================== Source scans: tooltips + placement ===================== */
{
  const term = readFileSync(join(ROOT, "components/ui/Term.tsx"), "utf8");
  assert.match(term, /tabIndex=\{0\}/, "terms are keyboard-focusable");
  assert.match(term, /aria-describedby=\{id\}/, "terms point at their explanation");
  assert.match(term, /role="tooltip"/);
  assert.match(term, /group-focus-within:block/, "explanation shows on keyboard focus, not hover only");
  assert.match(term, /print-hidden/, "tooltips never print");
  assert.match(term, /\bhidden\b/, "closed bubbles take no layout width");
  assert.match(term, /export function clampTip/, "open bubbles are clamped inside the viewport");
  assert.match(term, /onFocus=\{clampTip\}/, "clamped on keyboard focus too");

  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  for (const [what, re] of [
    // Tester Feedback Fix 4 extends the Judged tip with the gate source (TIP_JUDGED stays the base/fallback).
    ["Judged", /Judged: memo\.scope\.spendGateSource[\s\S]{0,200}TIP_JUDGED/],
    ["Set aside", /"Set aside": memo\.scope\.setAsideBreakdown/],
    ["Median <KPI>", /\[`Median \$\{viewKpiLabel\}`\]: TIP_MEDIAN/],
    ["judged spend", /phrase: "judged spend", tip: TIP_JUDGED_SPEND/],
    ["below-benchmark", /phrase: "below-benchmark", tip: TIP_BELOW_BENCHMARK/],
    ["Evidence state", /<Term tip=\{evidenceLine\(d, memo\.scope\.adsJudged, "client"\)\}>Evidence<\/Term>/],
    ["Brief readiness", /<Term tip=\{TIP_BRIEF_READINESS\}>Brief readiness<\/Term>/],
    ["readiness badges", /<Term tip=\{test\.briefReadiness\.client\}>/],
    ["Decision bars applied", /aria-describedby=\{barsTipId\}[\s\S]{0,300}Decision bars applied[\s\S]{0,80}<TipBubble id=\{barsTipId\}>/],
  ] as const) {
    assert.match(report, re, `tooltip wired: ${what}`);
  }
  // Tooltip copy reuses existing client wording (no invented definitions).
  assert.match(report, /const TIP_JUDGED = "Ads that had enough spend to judge fairly\."/);
  assert.match(report, /const TIP_MEDIAN = "The account's midpoint result\."/);
  // Buyer definition sits in the masthead, before the decision card.
  const defIdx = report.indexOf("Minimum spend to judge (evidence gate):");
  const cardIdx = report.indexOf("<DecisionCard");
  assert.ok(defIdx > 0 && cardIdx > defIdx, "buyer definition renders above the Next-move card");
  assert.match(report.slice(defIdx - 400, defIdx), /!client && memo\.scope\.spendGateLabel/, "definition is buyer-only");
  // Client card label.
  assert.match(report, /"Ready for a creative brief\?"/);
  assert.ok(!report.includes('"Creative pattern"'), "old client label gone");

  // No "past the median" anywhere in shipped engine/report source.
  for (const dir of ["modules/debrief", "components/debrief"]) {
    for (const f of readdirSync(join(ROOT, dir)).filter((n) => /\.tsx?$/.test(n))) {
      assert.ok(!readFileSync(join(ROOT, dir, f), "utf8").includes("past the median"), `${dir}/${f}: no "past the median"`);
    }
  }
  console.log("reportClarity: tooltips accessible and wired; buyer definition above the card; client label");
}

console.log("reportClarity: all assertions passed");
