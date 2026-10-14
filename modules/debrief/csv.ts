/**
 * Minimal RFC4180-ish CSV parser. Hand-written instead of adding a
 * dependency: Meta Ads Manager exports are simple, double-quote-escaped
 * UTF-8 — this covers that shape without pulling in a parsing library
 * for a one-request, in-memory operation.
 *
 * Handles: quoted fields, embedded delimiters/newlines inside quotes,
 * escaped quotes (""), CRLF/LF, a leading UTF-8 BOM, and trailing
 * blank lines.
 *
 * First-Run Robustness: regional exports (EU/MENA locales) use ";" or
 * TAB as the separator and a decimal comma ("1.234,56", "12,5"). The
 * delimiter is detected from the header line; the decimal style from
 * the body cells (see normalizeDecimalCommas) — so a semicolon +
 * decimal-comma file yields the same matrix as its comma equivalent.
 */

export type CsvDelimiter = "," | ";" | "\t";

/** The separator used by the header line (counted outside quotes).
 *  Comma wins ties and the no-separator case. */
export function detectDelimiter(text: string): CsvDelimiter {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const counts: Record<CsvDelimiter, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of clean) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && (ch === "," || ch === ";" || ch === "\t")) counts[ch] += 1;
  }
  let best: CsvDelimiter = ",";
  for (const d of [";", "\t"] as const) if (counts[d] > counts[best]) best = d;
  return best;
}

/** A cell's numeric core: currency symbols/codes, %, and spaces removed. */
function numericCore(cell: string): string {
  return cell.replace(/[€$£%\s\u00a0]|\b[A-Z]{3}\b/g, "");
}
/** Unambiguous decimal-comma numbers: "12,5", "1.234,56", "0,66". */
const COMMA_DECIMAL = /^-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d+$/;
/** Unambiguous decimal-point numbers: "12.5", "1,234.56". */
const DOT_DECIMAL = /^-?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d+$/;
/** "1,234" / "1.234" — thousands in one style, a decimal in the other. */
const AMBIGUOUS_GROUPS = /^-?\d{1,3}([.,])\d{3}$/;
/** Shapes rewritten in decimal-comma mode: optional dot-thousands
 *  groups, optional comma decimal. Never a date like "01.06.2026". */
const COMMA_MODE_NUMBER = /^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/;

/**
 * Decides the file's decimal style from its body cells and, for a
 * decimal-comma file, rewrites every purely-numeric cell to plain
 * "1234.56" form. Text cells (ad names, dates, URLs) never match the
 * numeric shape and pass through untouched. Returns the matrix unchanged
 * for decimal-point files.
 */
export function normalizeDecimalCommas(matrix: string[][]): { matrix: string[][]; decimalComma: boolean } {
  let comma = 0;
  let dot = 0;
  for (const row of matrix.slice(1)) {
    for (const cell of row) {
      const core = numericCore(cell);
      if (core === "" || AMBIGUOUS_GROUPS.test(core)) continue;
      if (COMMA_DECIMAL.test(core)) comma += 1;
      else if (DOT_DECIMAL.test(core)) dot += 1;
    }
  }
  if (comma <= dot) return { matrix, decimalComma: false };
  const out = matrix.map((row, i) =>
    i === 0
      ? row
      : row.map((cell) => {
          const core = numericCore(cell);
          return core !== "" && COMMA_MODE_NUMBER.test(core)
            ? core.replace(/\./g, "").replace(",", ".")
            : cell;
        })
  );
  return { matrix: out, decimalComma: true };
}

/** Parses with the detected delimiter and decimal style; reports both. */
export function parseCsvDetailed(text: string): {
  matrix: string[][];
  delimiter: CsvDelimiter;
  decimalComma: boolean;
} {
  const delimiter = detectDelimiter(text);
  const { matrix, decimalComma } = normalizeDecimalCommas(parseWith(text, delimiter));
  return { matrix, delimiter, decimalComma };
}

/** Delimiter- and decimal-aware parse (see parseCsvDetailed). */
export function parseCsv(text: string): string[][] {
  return parseCsvDetailed(text).matrix;
}

function parseWith(text: string, delimiter: CsvDelimiter): string[][] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];

    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // swallow; \n (or end of input) below closes the row
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  // Final field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

export function toTable(matrix: string[][]): CsvTable {
  if (matrix.length === 0) return { headers: [], rows: [] };
  const [headerRow, ...dataRows] = matrix;
  const headers = headerRow.map((h) => h.trim());
  const rows = dataRows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}

/** Strips currency/thousands formatting ("$1,234.50", "12%", "--") to a
 *  finite number, or null when the cell has no usable numeric value. */
export function parseNumericCell(raw: string | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "--" || trimmed === "-") return null;
  const cleaned = trimmed.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
