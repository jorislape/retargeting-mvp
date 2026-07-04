import { NextRequest, NextResponse } from "next/server";
import {
  analyze,
  extractAds,
  generateMemo,
  KPI_LABELS,
  KpiKey,
  parseCsv,
  requiredColumnsFor,
  resolveColumns,
  toTable,
  type DebriefApiError,
} from "@/modules/debrief";

/**
 * POST /api/debrief — the entire backend for this product.
 *
 * Stateless by design: the CSV is read into memory for this request
 * only, analyzed, turned into a memo, and returned. Nothing is written
 * to a database, disk, cache, or log — when the response is sent,
 * nothing about this upload remains anywhere. Do not add persistence
 * here; if a future version needs history, that's a new, explicit
 * milestone, not a quiet addition to this route.
 *
 * Errors are logged structurally (error codes / counts) — never with
 * CSV rows or memo content — so ops visibility doesn't compromise the
 * no-retention guarantee.
 *
 * Every failure returns a structured DebriefApiError (title / message /
 * how-to-fix, plus the CSV's own headers and KPI switch suggestions
 * where useful) so the UI can guide recovery instead of showing a
 * developer error. Headers are structural facts about the user's file,
 * returned only to the user — still never logged.
 */

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_DATA_ROWS = 5000;
const KPI_VALUES: KpiKey[] = ["roas", "cpa", "ctr", "cpc", "leads", "purchases"];
/** Cap the headers echoed back in errors — enough to debug any real
 *  Ads Manager export without ballooning the response. */
const MAX_ECHOED_COLUMNS = 40;

function ok(body: unknown) {
  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(status: number, error: DebriefApiError) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

const EXPORT_AT_AD_LEVEL =
  "Export ads at ad level for a date range with delivery.";

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, {
      title: "Upload failed",
      message: "The upload couldn't be read.",
      fix: "Try again — if it keeps happening, re-export the CSV from Meta Ads Manager.",
    });
  }

  const file = form.get("csv");
  if (!(file instanceof File)) {
    return fail(400, {
      title: "No CSV file",
      message: "No CSV file was included in the request.",
      fix: "Choose a CSV export from Meta Ads Manager, or load the sample dataset.",
    });
  }
  if (file.size === 0) {
    return fail(400, {
      title: "Empty file",
      message: "The CSV file is empty.",
      fix: EXPORT_AT_AD_LEVEL,
    });
  }
  if (file.size > MAX_FILE_BYTES) {
    return fail(400, {
      title: "File too large",
      message: `This CSV is over ${MAX_FILE_BYTES / 1024 / 1024}MB.`,
      fix: "Export a shorter date range or fewer columns from Ads Manager.",
    });
  }

  const kpi = form.get("kpi");
  if (typeof kpi !== "string" || !KPI_VALUES.includes(kpi as KpiKey)) {
    return fail(400, {
      title: "Invalid KPI",
      message: "The selected KPI isn't one Debrief can judge by.",
      fix: "Pick ROAS, CPA, CTR, CPC, Leads, or Purchases.",
    });
  }

  const targetCpaRaw = form.get("targetCpa");
  let targetCpa: number | null = null;
  if (typeof targetCpaRaw === "string" && targetCpaRaw.trim() !== "") {
    const parsed = Number(targetCpaRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fail(400, {
        title: "Invalid target CPA",
        message: "Target CPA must be a positive number.",
        fix: "Enter a positive number, or leave the field blank.",
      });
    }
    targetCpa = parsed;
  }

  const context = {
    kpi: kpi as KpiKey,
    product: String(form.get("product") ?? "").trim().slice(0, 200),
    offer: String(form.get("offer") ?? "").trim().slice(0, 200),
    goal: String(form.get("goal") ?? "").trim().slice(0, 200),
    targetCpa,
    creativeNotes: String(form.get("creativeNotes") ?? "").trim().slice(0, 1000),
    /* Optional pasted market/competitor notes — directional context for
       the memo only. Read into memory for this request like the rest of
       the context; never logged, never stored. */
    marketContext: String(form.get("marketContext") ?? "").trim().slice(0, 2000),
  };

  let text: string;
  try {
    text = await file.text();
  } catch {
    return fail(400, {
      title: "CSV could not be read",
      message: "Debrief could not read this file as a standard CSV.",
      fix: "Try exporting again from Meta Ads Manager as CSV, not XLSX.",
    });
  }

  /* Binary sniff: control characters in the first chunk mean this is
     an XLSX/zip/binary file, not a CSV — say so before the parser
     produces garbage headers. */
  if (/[\u0000-\u0008\u000E-\u001F]/.test(text.slice(0, 2000))) {
    return fail(400, {
      title: "CSV could not be read",
      message: "Debrief could not read this file as a standard CSV.",
      fix: "Try exporting again from Meta Ads Manager as CSV, not XLSX.",
    });
  }

  const matrix = parseCsv(text);
  if (matrix.length === 0) {
    return fail(400, {
      title: "CSV could not be read",
      message: "Debrief could not read this file as a standard CSV.",
      fix: "Try exporting again from Meta Ads Manager as CSV, not XLSX.",
    });
  }
  if (matrix.length - 1 > MAX_DATA_ROWS) {
    return fail(400, {
      title: "Too many rows",
      message: `This CSV has more than ${MAX_DATA_ROWS.toLocaleString()} ad rows.`,
      fix: "Export a shorter date range, or split the export and run it in parts.",
    });
  }

  const { headers, rows } = toTable(matrix);
  if (headers.length === 0) {
    return fail(400, {
      title: "CSV could not be read",
      message: "Debrief couldn't find a header row in this file.",
      fix: "Try exporting again from Meta Ads Manager as CSV, not XLSX.",
    });
  }
  const detectedColumns = headers.slice(0, MAX_ECHOED_COLUMNS);

  if (rows.length === 0) {
    return fail(400, {
      title: "No ad rows found",
      message: "The CSV appears to have headers but no ad rows.",
      fix: EXPORT_AT_AD_LEVEL,
      detectedColumns,
    });
  }

  const columns = resolveColumns(headers);

  /* Ad name is what makes the debrief readable (and what pattern hints
     key off) — a CSV without it is almost always a campaign- or
     adset-level export, so guide the user there instead of running
     with generic labels. */
  if (!columns.adName) {
    return fail(400, {
      title: "Ad name column not found",
      message: "I couldn't find an Ad name / Creative name column.",
      fix: "Export at ad level and include Ad name.",
      detectedColumns,
    });
  }

  const missing = requiredColumnsFor(context.kpi, columns);
  if (missing.length > 0) {
    if (missing.includes("Amount spent")) {
      return fail(400, {
        title: "Spend column not found",
        message: "I couldn't find an Amount Spent / Spend column in this CSV.",
        fix: "Export from Meta Ads Manager with Amount spent included, or rename your spend column to Amount spent.",
        detectedColumns,
      });
    }
    /* Spend exists but the selected KPI's column doesn't — say which
       KPIs WOULD work with this exact file. */
    const kpiLabel = KPI_LABELS[context.kpi];
    const suggestedKpis = KPI_VALUES.filter(
      (k) => k !== context.kpi && requiredColumnsFor(k, columns).length === 0
    );
    const suggestionText =
      suggestedKpis.length > 0
        ? ` Debrief did find columns for ${suggestedKpis.map((k) => KPI_LABELS[k]).join(", ")} — switching the KPI would work with this file.`
        : "";
    return fail(400, {
      title: `${kpiLabel} column not found`,
      message: `You selected ${kpiLabel}, but this CSV does not include a ${kpiLabel}-like column (looked for: ${missing.join(", ")}).`,
      fix: `Include ${missing.join(", ")} in your Meta export, or switch the KPI.${suggestionText}`,
      detectedColumns,
      suggestedKpis,
    });
  }

  const ads = extractAds(rows, columns, context.kpi);
  if (ads.length === 0) {
    return fail(400, {
      title: "No ad rows found",
      message: "No usable ad rows were found in this CSV.",
      fix: EXPORT_AT_AD_LEVEL,
      detectedColumns,
    });
  }

  try {
    const analysis = analyze(ads, rows, columns, context);
    const memo = generateMemo(analysis, context);
    return ok({ ok: true, memo });
  } catch (error) {
    console.error("debrief: analysis failed", {
      message: error instanceof Error ? error.message : "unknown",
      rowCount: rows.length,
    });
    return fail(500, {
      title: "Analysis failed",
      message: "Something went wrong analyzing this CSV.",
      fix: "Try again — if it keeps happening, re-export the CSV from Meta Ads Manager.",
    });
  }
}
