/**
 * Google Sheets API v4 — server-side only (API key stays in env).
 * Sheet must be shared as “Anyone with the link — Viewer”.
 */

import { logger } from "./logger";

const DEFAULT_SPREADSHEET_ID =
  "1EbT3Y1KQdMKUxrHhmezTnALdW3avdrkCrCft4mxt2kY";

export function getGoogleSheetsApiKey(): string | null {
  const k = process.env["GOOGLE_SHEETS_API_KEY"]?.trim();
  return k && k.length > 0 ? k : null;
}

export function getMasterSpreadsheetId(): string {
  const id =
    process.env["GOOGLE_SHEETS_SPREADSHEET_ID"]?.trim() ||
    process.env["INVENTORY_SHEET_ID"]?.trim();
  return id && id.length > 0 ? id : DEFAULT_SPREADSHEET_ID;
}

export function getInventoryTabName(): string {
  return (
    process.env["INVENTORY_SHEET_NAME"]?.trim() ||
    process.env["INVENTORY_TAB_NAME"]?.trim() ||
    "Equipment"
  );
}

export function getSupportingResourcesTabName(): string {
  return (
    process.env["SUPPORTING_RESOURCES_SHEET_NAME"]?.trim() ||
    "Supporting Resources"
  );
}

/** A1 notation range for all populated columns. */
export function tabRangeA1(tabName: string): string {
  const escaped = tabName.replace(/'/gu, "''");
  return `'${escaped}'!A:ZZ`;
}

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return String(v);
}

export type SheetMatrix = string[][];

export async function fetchSheetFormattedValues(
  spreadsheetId: string,
  rangeA1: string,
): Promise<SheetMatrix> {
  const key = getGoogleSheetsApiKey();
  if (!key) {
    throw new Error("GOOGLE_SHEETS_API_KEY is not configured");
  }

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeA1)}`,
  );
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
  url.searchParams.set("key", key);

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let detail = `Sheets API ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) detail = body.error.message;
    } catch {
      /* ignore */
    }
    logger.warn({ spreadsheetId, status: res.status, detail }, "Sheets API error");
    throw new Error(detail);
  }

  const json = (await res.json()) as { values?: unknown[][] };
  const raw = json.values ?? [];
  return raw.map((row) =>
    (row ?? []).map((cell) => cellToString(cell).trimEnd()),
  );
}

/** Row 0 = headers; returns trimmed header keys and string cell values. */
export function matrixToHeaderRows(matrix: SheetMatrix): {
  headers: string[];
  rows: string[][];
} {
  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }
  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((h, i) => {
    const t = cellToString(h).trim();
    return t.length > 0 ? t : `Column_${i + 1}`;
  });
  const rows = matrix.slice(1).map((r) => {
    const out: string[] = [];
    for (let i = 0; i < headers.length; i++) {
      out.push(cellToString(r[i] ?? "").trim());
    }
    return out;
  });
  return { headers, rows };
}

export function rowsToRecords(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((cells) => {
    const rec: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      rec[headers[i]!] = cells[i] ?? "";
    }
    return rec;
  });
}

function normalizeHeaderMap(headers: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const h of headers) {
    m.set(h.trim().toLowerCase(), h);
  }
  return m;
}

export function pickColumn(
  row: Record<string, string>,
  headers: string[],
  ...candidates: string[]
): string {
  const map = normalizeHeaderMap(headers);
  for (const c of candidates) {
    const key = map.get(c.toLowerCase());
    if (key !== undefined) {
      const v = row[key];
      if (v != null && String(v).trim().length > 0) return String(v).trim();
    }
  }
  return "";
}

export function slugifyCategoryId(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  if (base.length > 0) return base;
  return `category-${index}`;
}

export function matrixToSupportCategories(matrix: SheetMatrix): {
  categories: {
    id: string;
    title: string;
    contacts: { name: string; email: string }[];
  }[];
} {
  const { headers, rows } = matrixToHeaderRows(matrix);
  if (headers.length === 0) {
    return { categories: [] };
  }
  const records = rowsToRecords(headers, rows);
  const categoryOrder: string[] = [];
  const byCategory = new Map<string, { name: string; email: string }[]>();

  for (const rec of records) {
    const category = pickColumn(rec, headers, "category", "area", "type");
    const name = pickColumn(rec, headers, "name", "contact", "person");
    const email = pickColumn(rec, headers, "email", "e-mail", "mail");
    if (!category || !name || !email) continue;
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
      categoryOrder.push(category);
    }
    byCategory.get(category)!.push({ name, email });
  }

  const categories = categoryOrder.map((title, i) => ({
    id: slugifyCategoryId(title, i),
    title,
    contacts: byCategory.get(title) ?? [],
  }));

  return { categories };
}
