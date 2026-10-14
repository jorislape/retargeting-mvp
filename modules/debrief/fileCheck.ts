/**
 * First-Run Robustness — ONE validation path for an uploaded export,
 * shared by the API route and the generator's file card, so the card
 * can never say "ready" for a file the API would reject (and vice
 * versa). Pure: text in, either a parsed table or a structured
 * DebriefApiError out — the same title / message / how-to-fix copy the
 * route has always returned.
 *
 * Split in two so the file card can re-check the KPI part instantly
 * when the user changes KPI, without re-reading the file:
 *   checkExportStructure(text, sizeBytes) — KPI-independent
 *   checkExportKpi(structure, kpi)        — spend + selected KPI columns
 */
import { parseCsvDetailed, toTable, type CsvDelimiter } from "./csv";
import { EXPORT_AT_AD_LEVEL, requiredColumnsFor, resolveColumns, type ColumnMap } from "./columns";
import { DebriefApiError, KPI_LABELS, KpiKey } from "./types";

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_DATA_ROWS = 5000;
/** Cap on headers echoed back in errors (structural, uploader only). */
const MAX_ECHOED_COLUMNS = 40;
const KPI_VALUES: KpiKey[] = ["roas", "cpa", "ctr", "cpc", "leads", "purchases"];

const NOT_A_CSV: DebriefApiError = {
  title: "CSV could not be read",
  message: "Debrief could not read this file as a standard CSV.",
  fix: "Try exporting again from Meta Ads Manager as CSV, not XLSX.",
};

export interface ExportStructure {
  headers: string[];
  rows: Record<string, string>[];
  columns: ColumnMap;
  delimiter: CsvDelimiter;
  decimalComma: boolean;
  detectedColumns: string[];
}

export type CheckResult<T> = { ok: true; value: T } | { ok: false; error: DebriefApiError };

/** Everything that doesn't depend on the KPI: size, binary/XLSX, empty,
 *  one column (unrecognised separator), too many rows, no header, no
 *  rows, no Ad name column. */
export function checkExportStructure(text: string, sizeBytes?: number): CheckResult<ExportStructure> {
  /* Size first: the file card never reads an oversized file's text. */
  if (sizeBytes != null && sizeBytes > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: {
        title: "File too large",
        message: `This CSV is over ${MAX_FILE_BYTES / 1024 / 1024}MB.`,
        fix: "Export a shorter date range or fewer columns from Ads Manager.",
      },
    };
  }
  if (sizeBytes === 0 || text.trim() === "") {
    return { ok: false, error: { title: "Empty file", message: "The CSV file is empty.", fix: EXPORT_AT_AD_LEVEL } };
  }
  /* Control characters in the first chunk mean XLSX/zip/binary. */
  if (/[\u0000-\u0008\u000E-\u001F]/.test(text.slice(0, 2000))) return { ok: false, error: NOT_A_CSV };

  const { matrix, delimiter, decimalComma } = parseCsvDetailed(text);
  if (matrix.length === 0) return { ok: false, error: NOT_A_CSV };
  /* A real Ads Manager export always has several columns. One column
     means the separator wasn't recognised (or it isn't a CSV) — every
     row would read as one blob, so never produce a report from it. */
  if ((matrix[0]?.length ?? 0) <= 1) {
    return {
      ok: false,
      error: {
        title: "Only one column found",
        message:
          "This looks like a semicolon/regional CSV using a separator Debrief couldn't recognise — every row read as a single column.",
        fix: "Re-export from Meta Ads Manager as CSV (comma-, semicolon- or tab-separated). If you saved it from Excel, choose \"CSV UTF-8\".",
        detectedColumns: (matrix[0] ?? []).slice(0, 1).map((h) => h.slice(0, 120)),
      },
    };
  }
  if (matrix.length - 1 > MAX_DATA_ROWS) {
    return {
      ok: false,
      error: {
        title: "Too many rows",
        message: `This CSV has more than ${MAX_DATA_ROWS.toLocaleString()} ad rows.`,
        fix: "Export a shorter date range, or split the export and run it in parts.",
      },
    };
  }
  const { headers, rows } = toTable(matrix);
  if (headers.length === 0) {
    return { ok: false, error: { ...NOT_A_CSV, message: "Debrief couldn't find a header row in this file." } };
  }
  const detectedColumns = headers.slice(0, MAX_ECHOED_COLUMNS);
  if (rows.length === 0) {
    return {
      ok: false,
      error: { title: "No ad rows found", message: "The CSV appears to have headers but no ad rows.", fix: EXPORT_AT_AD_LEVEL, detectedColumns },
    };
  }
  const columns = resolveColumns(headers);
  if (!columns.adName) {
    return {
      ok: false,
      error: {
        title: "Ad name column not found",
        message: "I couldn't find an Ad name / Creative name column.",
        fix: "Export at ad level and include Ad name.",
        detectedColumns,
      },
    };
  }
  return { ok: true, value: { headers, rows, columns, delimiter, decimalComma, detectedColumns } };
}

/** The KPI-dependent part: a spend column, and the selected KPI's
 *  columns — with the KPIs this exact file WOULD support suggested. */
export function checkExportKpi(structure: ExportStructure, kpi: KpiKey): CheckResult<ExportStructure> {
  const { columns, detectedColumns } = structure;
  const missing = requiredColumnsFor(kpi, columns);
  if (missing.length === 0) return { ok: true, value: structure };
  if (missing.includes("Amount spent")) {
    return {
      ok: false,
      error: {
        title: "Spend column not found",
        message: "I couldn't find an Amount Spent / Spend column in this CSV.",
        fix: "Export from Meta Ads Manager with Amount spent included, or rename your spend column to Amount spent.",
        detectedColumns,
      },
    };
  }
  const kpiLabel = KPI_LABELS[kpi];
  const suggestedKpis = KPI_VALUES.filter((k) => k !== kpi && requiredColumnsFor(k, columns).length === 0);
  const suggestionText =
    suggestedKpis.length > 0
      ? ` Debrief did find columns for ${suggestedKpis.map((k) => KPI_LABELS[k]).join(", ")} — switching the KPI would work with this file.`
      : "";
  return {
    ok: false,
    error: {
      title: `${kpiLabel} column not found`,
      message: `You selected ${kpiLabel}, but this CSV does not include a ${kpiLabel}-like column (looked for: ${missing.join(", ")}).`,
      fix: `Include ${missing.join(", ")} in your Meta export, or switch the KPI.${suggestionText}`,
      detectedColumns,
      suggestedKpis,
    },
  };
}

/** Both checks, in order — what the API route runs. */
export function checkExport(text: string, kpi: KpiKey, sizeBytes?: number): CheckResult<ExportStructure> {
  const structure = checkExportStructure(text, sizeBytes);
  return structure.ok ? checkExportKpi(structure.value, kpi) : structure;
}
