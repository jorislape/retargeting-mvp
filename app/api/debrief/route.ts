import { NextRequest, NextResponse } from "next/server";
import {
  analyze,
  extractAds,
  generateMemo,
  KpiKey,
  parseCsv,
  requiredColumnsFor,
  resolveColumns,
  toTable,
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
 */

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_DATA_ROWS = 5000;
const KPI_VALUES: KpiKey[] = ["roas", "cpa", "ctr", "cpc", "leads", "purchases"];

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return noStore({ ok: false, error: "Couldn't read the upload. Try again." }, 400);
  }

  const file = form.get("csv");
  if (!(file instanceof File)) {
    return noStore({ ok: false, error: "No CSV file was uploaded." }, 400);
  }
  if (file.size === 0) {
    return noStore({ ok: false, error: "The CSV file is empty." }, 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return noStore(
      { ok: false, error: `CSV is too large — please keep it under ${MAX_FILE_BYTES / 1024 / 1024}MB.` },
      400
    );
  }

  const kpi = form.get("kpi");
  if (typeof kpi !== "string" || !KPI_VALUES.includes(kpi as KpiKey)) {
    return noStore({ ok: false, error: "Pick a valid KPI to analyze." }, 400);
  }

  const targetCpaRaw = form.get("targetCpa");
  let targetCpa: number | null = null;
  if (typeof targetCpaRaw === "string" && targetCpaRaw.trim() !== "") {
    const parsed = Number(targetCpaRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return noStore({ ok: false, error: "Target CPA must be a positive number." }, 400);
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
  };

  let text: string;
  try {
    text = await file.text();
  } catch {
    return noStore({ ok: false, error: "Couldn't read the CSV file." }, 400);
  }

  const matrix = parseCsv(text);
  if (matrix.length < 2) {
    return noStore(
      { ok: false, error: "CSV needs a header row and at least one data row." },
      400
    );
  }
  if (matrix.length - 1 > MAX_DATA_ROWS) {
    return noStore(
      { ok: false, error: `CSV has too many rows — please export up to ${MAX_DATA_ROWS.toLocaleString()} at a time.` },
      400
    );
  }

  const { headers, rows } = toTable(matrix);
  if (headers.length === 0) {
    return noStore({ ok: false, error: "Couldn't find a header row in the CSV." }, 400);
  }

  const columns = resolveColumns(headers);
  const missing = requiredColumnsFor(context.kpi, columns);
  if (missing.length > 0) {
    return noStore(
      {
        ok: false,
        error: `This CSV is missing what's needed for ${context.kpi.toUpperCase()}: ${missing.join(", ")}. Re-export from Ads Manager with those columns included.`,
      },
      400
    );
  }

  const ads = extractAds(rows, columns, context.kpi);
  if (ads.length === 0) {
    return noStore(
      { ok: false, error: "No usable ad rows were found in this CSV." },
      400
    );
  }

  try {
    const analysis = analyze(ads, rows, columns, context);
    const memo = generateMemo(analysis, context);
    return noStore({ ok: true, memo });
  } catch (error) {
    console.error("debrief: analysis failed", {
      message: error instanceof Error ? error.message : "unknown",
      rowCount: rows.length,
    });
    return noStore(
      { ok: false, error: "Something went wrong analyzing this CSV. Please try again." },
      500
    );
  }
}
