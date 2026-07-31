import { Router } from "express";

import { logger } from "../lib/logger";
import {
  fetchSheetFormattedValues,
  getGoogleSheetsApiKey,
  getInventoryTabName,
  getMasterSpreadsheetId,
  matrixToHeaderRows,
  rowsToRecords,
  tabRangeA1,
} from "../lib/sheets";

const router = Router();

router.get("/inventory", async (_req, res) => {
  if (!getGoogleSheetsApiKey()) {
    logger.warn("GET /inventory — GOOGLE_SHEETS_API_KEY missing");
    return res.status(503).json({
      error: "inventory_unavailable",
      message: "Inventory is not configured (missing GOOGLE_SHEETS_API_KEY).",
    });
  }

  const spreadsheetId = getMasterSpreadsheetId();
  const tab = getInventoryTabName();
  const range = tabRangeA1(tab);

  try {
    const matrix = await fetchSheetFormattedValues(spreadsheetId, range);
    const { headers, rows } = matrixToHeaderRows(matrix);
    const items = rowsToRecords(headers, rows).filter((item) =>
      Object.values(item).some((v) => v.length > 0),
    );
    return res.json({ headers, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    logger.warn({ err: e, spreadsheetId, tab }, "GET /inventory failed");
    return res.status(502).json({
      error: "inventory_fetch_failed",
      message,
    });
  }
});

export default router;
