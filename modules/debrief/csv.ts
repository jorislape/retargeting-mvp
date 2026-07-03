/**
 * Minimal RFC4180-ish CSV parser. Hand-written instead of adding a
 * dependency: Meta Ads Manager exports are simple, comma-delimited,
 * double-quote-escaped UTF-8 — this covers that shape without pulling
 * in a parsing library for a one-request, in-memory operation.
 *
 * Handles: quoted fields, embedded commas/newlines inside quotes,
 * escaped quotes (""), CRLF/LF, a leading UTF-8 BOM, and trailing
 * blank lines.
 */
export function parseCsv(text: string): string[][] {
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
    } else if (char === ",") {
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
