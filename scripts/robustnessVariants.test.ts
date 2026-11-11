/**
 * Robustness Sweep — no real Meta export should silently produce wrong
 * numbers.
 *
 * Every synthetic Ads Manager export in scripts/fixtures/variants/ goes
 * through the SAME path an upload takes (fileCheck.checkExport → extract
 * → analyze → memo) and must match the hand-written per-ad spend /
 * purchases / ROAS in fixtures/variants/expected.ts within 0.01 — at the
 * parse step (the ParsedAd list) and at the engine step (the analysis:
 * total spend, ad count, every judged ad, the median). A file Debrief
 * can't read correctly must be refused with a clear reason instead.
 *
 * Variants listed in PENDING reproduce a bug that isn't fixed yet: they
 * must FAIL, so the reproduction is proven; fixing the bug removes the
 * entry and the variant becomes its regression test.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";
import { EXPECTED, PENDING, type AdExpect, type Expectation } from "./fixtures/variants/expected.ts";
import { VARIANTS } from "./fixtures/variants/generate.ts";

const DIR = join(ROOT, "scripts/fixtures/variants");
const TOLERANCE = 0.01;

interface Ad {
  name: string;
  spend: number;
  kpiValue: number | null;
  conversions?: number | null;
}
interface Structure {
  rows: Record<string, string>[];
  columns: Record<string, unknown>;
  notes?: string[];
}
type Check = { ok: true; value: Structure } | { ok: false; error: { title: string; message: string; fix: string } };

const close = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? (a ?? null) === (b ?? null) : Math.abs(a - b) <= TOLERANCE;
const show = (v: number | null | undefined) => (v == null ? "none" : String(Math.round(v * 10000) / 10000));

const { requireCompiled, cleanup } = loadEngine();
try {
  const { checkExport } = requireCompiled("modules/debrief/fileCheck.js") as {
    checkExport: (text: string, kpi: string, size?: number, cpaOutcome?: string | null) => Check;
  };
  const { extractAds } = requireCompiled("modules/debrief/extract.js") as {
    extractAds: (rows: unknown, columns: unknown, kpi: string, cpaOutcome?: string | null) => Ad[];
  };
  const { analyze } = requireCompiled("modules/debrief/analysis.js") as {
    analyze: (ads: Ad[], rows: unknown, columns: unknown, ctx: unknown) => {
      totalSpend: number;
      adsAnalyzed: number;
      median: number | null;
      rankedAds: Ad[];
    };
  };
  const { generateMemo } = requireCompiled("modules/debrief/memo.js") as { generateMemo: (a: unknown, ctx: unknown) => unknown };
  const { kpiSourcePreview } = requireCompiled("modules/debrief/columns.js") as {
    kpiSourcePreview: (kpi: string, columns: unknown, basis?: string) => string | null;
  };

  /** Every way a variant disagrees with its expectation (empty = pass). */
  function problems(text: string, expected: Expectation): string[] {
    const kpi = "refused" in expected ? "roas" : (expected.kpi ?? "roas");
    const cpaOutcome = "refused" in expected ? null : (expected.cpaOutcome ?? null);
    const checked = checkExport(text, kpi, undefined, cpaOutcome);
    if ("refused" in expected) {
      if (checked.ok) return ["read as a normal export, but it must be refused"];
      const out: string[] = [];
      if (!expected.refused.test(checked.error.title)) out.push(`refused as "${checked.error.title}", expected ${expected.refused}`);
      if (expected.message && !expected.message.test(`${checked.error.message} ${checked.error.fix}`))
        out.push(`refusal doesn't say ${expected.message}: "${checked.error.message} ${checked.error.fix}"`);
      return out;
    }
    if (!checked.ok) return [`refused: ${checked.error.title} — ${checked.error.message}`];
    const { rows, columns } = checked.value;
    const ctx = { kpi, cpaOutcome, product: "", offer: "", targetCpa: null, creativeNotes: "", marketContext: "" };
    const ads = extractAds(rows, columns, kpi, cpaOutcome);
    const analysis = analyze(ads, rows, columns, ctx);
    generateMemo(analysis, ctx); // the memo must build from it without throwing
    const out: string[] = [];

    /* Parse step — the ads Debrief read. */
    const want = Object.entries(expected.ads);
    const byName = new Map(ads.map((a) => [a.name, a]));
    for (const a of ads) if (!(a.name in expected.ads)) out.push(`parse: unexpected ad "${a.name}" (spend ${show(a.spend)})`);
    const compare = (step: string, name: string, got: Ad, e: AdExpect) => {
      const kpiWant = kpi === "roas" ? e.roas : e.cpa;
      const countWant = cpaOutcome === "conversation" ? e.conversations : e.purchases;
      if (!close(got.spend, e.spend)) out.push(`${step}: "${name}" spend ${show(got.spend)}, expected ${show(e.spend)}`);
      if (!close(got.kpiValue, kpiWant)) out.push(`${step}: "${name}" ${kpi.toUpperCase()} ${show(got.kpiValue)}, expected ${show(kpiWant)}`);
      if (countWant !== undefined && !close(got.conversions, countWant))
        out.push(`${step}: "${name}" ${cpaOutcome ? "conversations" : "purchases"} ${show(got.conversions)}, expected ${show(countWant)}`);
    };
    for (const [name, e] of want) {
      const got = byName.get(name);
      if (!got) out.push(`parse: ad "${name}" is missing`);
      else compare("parse", name, got, e);
    }

    /* Engine step — what the analysis carries into the report. */
    if (!close(analysis.totalSpend, expected.totalSpend)) out.push(`engine: total spend ${show(analysis.totalSpend)}, expected ${show(expected.totalSpend)}`);
    if (analysis.adsAnalyzed !== want.length) out.push(`engine: ${analysis.adsAnalyzed} ads analyzed, expected ${want.length}`);
    for (const r of analysis.rankedAds) {
      const e = expected.ads[r.name];
      if (!e) out.push(`engine: judged an unexpected ad "${r.name}"`);
      else compare("engine", r.name, r, e);
    }
    if (expected.median != null && !close(analysis.median, expected.median))
      out.push(`engine: median ${show(analysis.median)}, expected ${show(expected.median)}`);

    /* File card — the source line plus the file's disclosures. */
    const basis = cpaOutcome === "conversation" ? "conversations" : undefined;
    const card = [kpiSourcePreview(kpi, columns, basis) ?? "", ...(checked.value.notes ?? [])].join("\n");
    for (const re of expected.card ?? []) if (!re.test(card)) out.push(`file card doesn't show ${re}: "${card.replace(/\n/g, " | ")}"`);
    return out;
  }

  /* The folder, the generator and the expectations describe the same set. */
  const files = readdirSync(DIR).filter((f) => f.endsWith(".csv")).sort();
  const ids = files.map((f) => f.replace(/\.csv$/, ""));
  assert.ok(ids.length >= 40, `at least 40 variants (found ${ids.length})`);
  assert.deepEqual(ids, Object.keys(EXPECTED).sort(), "every variant has a hand-written expectation, and vice versa");
  assert.deepEqual(VARIANTS.map((v) => v.file).sort(), files, "the generator writes exactly the committed files");
  for (const v of VARIANTS) {
    assert.equal(readFileSync(join(DIR, v.file), "utf8"), v.text, `${v.file} is stale — run node scripts/fixtures/variants/generate.ts`);
  }
  for (const id of Object.keys(PENDING)) assert.ok(id in EXPECTED, `pending variant ${id} exists`);

  const failures: string[] = [];
  let passed = 0;
  for (const id of ids) {
    const found = problems(readFileSync(join(DIR, `${id}.csv`), "utf8"), EXPECTED[id]);
    if (id in PENDING) {
      if (found.length === 0) failures.push(`${id}: listed as a known bug (${PENDING[id]}) but passes — remove it from PENDING`);
      else console.log(`  known bug reproduced — ${id}: ${PENDING[id]}\n      ${found[0]}`);
      continue;
    }
    if (found.length > 0) failures.push(`${id}:\n    ${found.join("\n    ")}`);
    else passed += 1;
  }
  assert.equal(failures.length, 0, `\n${failures.join("\n")}\n`);
  const pending = Object.keys(PENDING).length;
  console.log(
    `robustness variants: ${passed} of ${ids.length} exports match their hand-written numbers` +
      (pending > 0 ? `; ${pending} reproduce a known bug` : "")
  );
} finally {
  cleanup();
}
