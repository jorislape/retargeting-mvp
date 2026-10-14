/**
 * First-Run Robustness 1 — validate the file on drop, regional CSVs.
 *
 * fileCheck.ts is the ONE validation path (API route + file card).
 * Proves: a semicolon + decimal-comma export (and a tab one) produces
 * the SAME memo as its comma equivalent; a file that parses to a single
 * column fails with a clear separator message and never yields a
 * report; every invalid fixture fails with the existing how-to-fix copy;
 * and the generator gates Generate / "ready" / "Complete" on it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const fx = (n: string) => readFileSync(join(ROOT, "scripts/fixtures", n), "utf8");
type Err = { title: string; message: string; fix: string; suggestedKpis?: string[] };
type Check = { ok: true; value: { delimiter: string; decimalComma: boolean; headers: string[] } } | { ok: false; error: Err };

const { run, requireCompiled, cleanup } = loadEngine();
try {
  const { checkExport } = requireCompiled("modules/debrief/fileCheck.js") as {
    checkExport: (text: string, kpi: string, size?: number) => Check;
  };
  const { parseCsvDetailed } = requireCompiled("modules/debrief/csv.js") as {
    parseCsvDetailed: (t: string) => { matrix: string[][]; delimiter: string; decimalComma: boolean };
  };

  /* ---- Regional exports read the same as their comma equivalent ---- */
  const comma = fx("ecom-13ads.csv");
  const semi = fx("regional-semicolon.csv");
  const tab = semi.replace(/;/g, "\t");
  const s = checkExport(semi, "roas");
  assert.ok(s.ok && s.value.delimiter === ";" && s.value.decimalComma, "semicolon + decimal comma detected");
  const t = checkExport(tab, "roas");
  assert.ok(t.ok && t.value.delimiter === "\t" && t.value.decimalComma, "tab detected");
  const c = checkExport(comma, "roas");
  assert.ok(c.ok && c.value.delimiter === "," && !c.value.decimalComma, "comma file untouched");
  for (const kpi of ["roas", "cpa", "ctr"]) {
    const a = run(comma, kpi);
    for (const [label, text] of [["semicolon", semi], ["tab", tab]] as const) {
      const b = run(text, kpi);
      assert.equal(b.analysis.median, a.analysis.median, `${label}/${kpi} median`);
      assert.equal(b.analysis.spendGate, a.analysis.spendGate, `${label}/${kpi} gate`);
      assert.deepEqual(b.analysis.rankedAds.map((x) => [x.name, x.kpiValue]), a.analysis.rankedAds.map((x) => [x.name, x.kpiValue]));
      assert.equal(JSON.stringify(b.memo), JSON.stringify(a.memo), `${label}/${kpi}: memo identical to the comma export`);
    }
  }
  // Decimal-comma cells become plain numbers; dates and text are untouched.
  const p = parseCsvDetailed("Ad name;Reporting starts;Amount spent (EUR);ROAS\nPromo 20,5%;01.06.2026;1.234,56;2,5\nB;02.06.2026;12,5;0,66\n");
  assert.deepEqual(p.matrix[1], ["Promo 20,5%", "01.06.2026", "1234.56", "2.5"]);
  // A US file with thousands separators stays decimal-point.
  assert.equal(parseCsvDetailed('Ad name,Spend,ROAS\nA,"1,234.56",2.5\nB,"2,000.10",1.5\n').decimalComma, false);

  /* ---- Invalid files fail with clear copy (never a report) ---- */
  const cases: [string, string, number | undefined, string][] = [
    ["single column", fx("invalid-single-column.csv"), undefined, "Only one column found"],
    ["campaign level", fx("invalid-campaign-level.csv"), undefined, "Ad name column not found"],
    ["no spend", fx("invalid-no-spend.csv"), undefined, "Spend column not found"],
    ["header only", fx("invalid-header-only.csv"), undefined, "No ad rows found"],
    ["binary/XLSX", "PK\u0003\u0004\u0014\u0000\u0006\u0000xl/workbook.xml", undefined, "CSV could not be read"],
    ["empty", "", 0, "Empty file"],
    ["too large", "x", 6 * 1024 * 1024, "File too large"],
  ];
  for (const [label, text, size, title] of cases) {
    const r = checkExport(text, "roas", size);
    assert.ok(!r.ok, `${label} fails`);
    if (!r.ok) {
      assert.equal(r.error.title, title, label);
      assert.ok(r.error.message.length > 0 && r.error.fix.length > 0, `${label}: message + how-to-fix`);
    }
  }
  const single = checkExport(fx("invalid-single-column.csv"), "roas");
  assert.ok(!single.ok && /semicolon\/regional CSV/.test(single.error.message));
  // Missing selected KPI → error with the one-click switch suggestions.
  const noRoas = checkExport(fx("tester-cpa-8ads.csv"), "roas");
  assert.ok(!noRoas.ok && noRoas.error.title === "ROAS column not found" && noRoas.error.suggestedKpis?.includes("cpa"));

  /* ---- Wiring: route + generator use the shared check ---- */
  const route = readFileSync(join(ROOT, "app/api/debrief/route.ts"), "utf8");
  assert.match(route, /const checked = checkExport\(text, context\.kpi\);\s*if \(!checked\.ok\) return fail\(400, checked\.error\);/);
  const gen = readFileSync(join(ROOT, "components/debrief/GeneratorPanel.tsx"), "utf8");
  assert.match(gen, /const checked = checkExportStructure\(text, file\.size\);/, "checked on drop");
  assert.match(gen, /const canSubmit = !!file && fileUsable;/, "Generate disabled for an unusable file");
  assert.match(gen, /status=\{!file \? "Required" : fileUsable \? "Complete" : fileError \? "Needs attention" : "Checking…"\}/);
  assert.match(gen, /\{fmtBytes\(file\.size\)\} · \{fileUsable \? "ready" : fileError \? "can't be used yet" : "checking…"\}/);
  assert.match(gen, /\{fileError && \(\s*<div role="alert"/, "error shown inside the file card");
  assert.ok(!/const canSubmit = !!file;/.test(gen));

  console.log("fileCheck: all assertions passed");
} finally {
  cleanup();
}
