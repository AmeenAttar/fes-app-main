import { Router } from "express";

import { logger } from "../lib/logger";
import {
  fetchSheetFormattedValues,
  getGoogleSheetsApiKey,
  getMasterSpreadsheetId,
  getSupportingResourcesTabName,
  matrixToSupportCategories,
  tabRangeA1,
} from "../lib/sheets";

const router = Router();

router.get("/supporting-resources", async (_req, res) => {
  if (!getGoogleSheetsApiKey()) {
    logger.warn("GET /supporting-resources — GOOGLE_SHEETS_API_KEY missing");
    return res.status(503).json({
      error: "supporting_resources_unavailable",
      message: "Supporting resources are not configured (missing GOOGLE_SHEETS_API_KEY).",
    });
  }

  const spreadsheetId = getMasterSpreadsheetId();
  const tab = getSupportingResourcesTabName();
  const range = tabRangeA1(tab);

  try {
    const matrix = await fetchSheetFormattedValues(spreadsheetId, range);
    const { categories } = matrixToSupportCategories(matrix);
    return res.json({ categories });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    logger.warn({ err: e, spreadsheetId, tab }, "GET /supporting-resources failed");
    return res.status(502).json({
      error: "supporting_resources_fetch_failed",
      message,
    });
  }
});

export default router;
