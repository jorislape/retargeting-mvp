/**
 * Tester Feedback Fixes — shared harness for the six proofs
 * (scripts/tester*.test.ts). Compiles the real debrief engine +
 * memoToText to CommonJS in a temp dir (same approach as
 * reportClarity.test.ts) and exposes a one-call run(csv, kpi, ctx).
 * Not a test itself; the caller must call cleanup() when done.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AnalysisResult, Memo, ParsedAd } from "../modules/debrief/types.ts";

const require = createRequire(import.meta.url);
export const ROOT = join(import.meta.dirname, "..");
export const TESTER_CSV = readFileSync(join(ROOT, "scripts/fixtures/tester-cpa-8ads.csv"), "utf8");
export const CLIENT_BANNED = ["kill", "gate", "benchmark", "median", "judged"];

export function loadEngine() {
  const dist = mkdtempSync(join(tmpdir(), "debrief-tester-"));
  execSync(
    `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
    { cwd: ROOT, stdio: "pipe" }
  );
  const r = (p: string) => require(join(dist, p));
  const { parseCsv, toTable } = r("modules/debrief/csv.js");
  const { resolveColumns } = r("modules/debrief/columns.js");
  const { extractAds } = r("modules/debrief/extract.js");
  const { analyze } = r("modules/debrief/analysis.js");
  const { generateMemo } = r("modules/debrief/memo.js");
  const { buildSampleMemo } = r("modules/debrief/sample.js");
  const { memoToText } = r("components/debrief/memoToText.js");

  const run = (csv: string, kpi = "cpa", extra: Record<string, unknown> = {}) => {
    const ctx = { kpi, product: "", offer: "", targetCpa: null, creativeNotes: "", marketContext: "", ...extra };
    const { headers, rows } = toTable(parseCsv(csv));
    const columns = resolveColumns(headers);
    const ads = extractAds(rows, columns, kpi);
    const analysis = analyze(ads, rows, columns, ctx);
    const memo = generateMemo(analysis, ctx);
    return {
      columns: columns as Record<string, string | null>,
      ads: ads as ParsedAd[],
      analysis: analysis as AnalysisResult,
      memo: memo as Memo,
      buyerText: memoToText(memo, "buyer", 5, []) as string,
      clientText: memoToText(memo, "client", 3, []) as string,
    };
  };
  return {
    run,
    buildSampleMemo: buildSampleMemo as () => Memo,
    memoToText: memoToText as (m: Memo, view: string, top: number, briefs: number[]) => string,
    cleanup: () => rmSync(dist, { recursive: true, force: true }) };
}

/** Every client-register memo string (decision, summary, lists, tests,
 *  limits, confidence) — for blocklist scans. */
export function clientStrings(memo: Memo): string[] {
  const d = memo.decision;
  return [
    d.clientHeadline, d.clientRationale, ...d.avoidNow.client, d.reassess.client, ...d.limits.client,
    ...memo.clientSummary, memo.losers.clientInstruction,
    ...(memo.atMedian ? [memo.atMedian.clientLabel] : []),
    memo.confidence.clientWhy,
  ].filter((s): s is string => typeof s === "string");
}
