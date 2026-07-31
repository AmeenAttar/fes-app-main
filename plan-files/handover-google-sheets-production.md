# Google Sheets — Setup for Production (App Store–Ready)

This document describes how the Cleveland FES Center app loads **Supporting Resources** and **Equipment Inventory** from a single Google Sheet, how to configure Google Cloud and your API server for **production**, and how that ties to an **iOS / App Store** release.

**Related:** `handover-release.md` (EAS, TestFlight, App Store), `handover-tech.md` (architecture and env vars).

---

## What the app does

| Screen | Data source | API route | Sheet tab (default name) |
|--------|-------------|-----------|---------------------------|
| Supporting Resources | Google Sheet (grouped by category) | `GET /api/supporting-resources` | `Supporting Resources` |
| Equipment Inventory | Google Sheet (rows as items) | `GET /api/inventory` | `Equipment` |

The **Expo app never talks to Google directly**. It calls your **deployed API** (`EXPO_PUBLIC_DOMAIN`). The **api-server** calls the [Google Sheets API v4](https://developers.google.com/sheets/api) using a **server-side secret**.

**Code references:** `artifacts/api-server/src/lib/sheets.ts`, `artifacts/api-server/src/routes/inventory.ts`, `artifacts/api-server/src/routes/supporting-resources-sheet.ts`, `artifacts/fes-app/lib/api.ts`.

---

## Production architecture (secrets)

```
┌─────────────────────┐     HTTPS      ┌──────────────────────┐
│  iOS app (App Store)│ ──────────────►│  Your API (api-server)│
│  EXPO_PUBLIC_DOMAIN │   /api/*        │  GOOGLE_SHEETS_API_KEY│
└─────────────────────┘                 │  (secret, never in app)│
                                        └──────────┬───────────┘
                                                   │
                                                   ▼
                                        Google Sheets API v4
                                                   │
                                                   ▼
                                        ┌──────────────────────┐
                                        │  Google Sheet         │
                                        │  (link-shared Viewer)│
                                        └──────────────────────┘
```

**Rules for App Store / production safety**

- **`GOOGLE_SHEETS_API_KEY` lives only on the server** (Replit Secrets, EAS *does not* need it for the client build).
- **Never** commit API keys, service account JSON, or private keys to git. **Never** paste them in chat or tickets.
- If a key is ever exposed, **revoke it in Google Cloud** and create a new one; treat the old key as compromised.
- The mobile app only needs **`EXPO_PUBLIC_DOMAIN`** set to the **production** API hostname (HTTPS, no trailing slash), e.g. in `artifacts/fes-app/eas.json` for the `production` build profile.

---

## Google Cloud: one-time setup

### 1. Select or create a project

Use a dedicated Google Cloud project (e.g. the one you already use) so billing, APIs, and keys are isolated and auditable.

### 2. Enable the Google Sheets API

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Library**.
2. Search for **Google Sheets API** → **Enable**.

Without this, requests from your API server will fail with API errors (often HTTP 403 with a message that the API is disabled).

### 3. Create an API key (recommended for the current app)

1. **APIs & Services** → **Credentials** → **Create credentials** → **API key**.
2. Copy the key **once**; you will store it only as `GOOGLE_SHEETS_API_KEY` on the server.

### 4. Restrict the API key (strongly recommended for production)

1. Open the key → **Application restrictions**:
   - For a **server** with a **stable IP**, use **IP addresses** and add your deployment egress IPs.
   - If the server IP is not fixed, use **None** for application restriction but rely on **API restrictions** (below) and network security of your host.
2. **API restrictions** → **Restrict key** → select **Google Sheets API** only.

This limits damage if the key ever leaks.

### 5. Spreadsheet access model (matches current code)

The implementation uses an **API key** and the spreadsheet values endpoint. For that to work reliably, the spreadsheet should be shared so the API can read it:

- In Google Sheets: **Share** → **General access** → **Anyone with the link** → **Viewer** (or at minimum ensure the data is readable by the API in your chosen access model).

**Tab names** must match what the server expects (or set env overrides):

- Default equipment tab: **`Equipment`**
- Default supporting resources tab: **`Supporting Resources`**

**Header row (row 1)**

- **Supporting Resources:** `Category`, `Name`, `Email` (other header names are accepted via flexible matching; see `matrixToSupportCategories` in `sheets.ts`).
- **Equipment:** any columns you need; the app renders **all** headers dynamically. For thumbnails, use a column whose name includes **Image**, **Photo**, or **Thumbnail** (e.g. `Image_URL`) with an `http://` or `https://` URL in the cell.

### 6. Service accounts (optional, not in current code path)

A **service account** is a different auth model: you create a service account, share the sheet with its **client email** as Viewer, and the server would authenticate with a **JSON key** using OAuth2. **The current api-server only implements API-key auth** in `sheets.ts`. If you need a private sheet with no “anyone with the link” access, you would add server-side support for service account credentials in a follow-up change; do **not** store JSON key files in the repo—use environment or a secret manager.

---

## Environment variables (production)

### api-server (required for Sheets)

| Variable | Required for Sheets | Default / notes |
|----------|---------------------|----------------|
| `GOOGLE_SHEETS_API_KEY` | **Yes** (for both inventory and supporting resources) | Get from **Credentials** in Google Cloud. |
| `GOOGLE_SHEETS_SPREADSHEET_ID` or `INVENTORY_SHEET_ID` | No | If unset, the repo default ID is used (the FES master workbook). Override when you use a different file. |
| `INVENTORY_SHEET_NAME` or `INVENTORY_TAB_NAME` | No | Default: `Equipment`. |
| `SUPPORTING_RESOURCES_SHEET_NAME` | No | Default: `Supporting Resources`. |

Set these in **Replit Secrets**, your host’s **environment**, or your platform’s **secret** store for the **production** api-server process. Restart the server after changes.

**Local template:** `artifacts/api-server/.env.example` (do not put real secrets in the example file).

### fes-app (Expo / EAS — App Store build)

| Variable | Required | Notes |
|----------|----------|--------|
| `EXPO_PUBLIC_DOMAIN` | **Yes** | **Production** API hostname only, no `https://`, no trailing slash. Baked into the app at build time. Must match the server that has `GOOGLE_SHEETS_API_KEY` set. |

Set `EXPO_PUBLIC_DOMAIN` in `artifacts/fes-app/eas.json` for the **production** profile (replace `REPLACE_WITH_DEPLOYED_API_DOMAIN`) before `eas build --profile production`. See `handover-release.md` for the full iOS pipeline.

---

## API responses (for verification)

- **`GET /api/inventory`**  
  - Success: `{ "headers": string[], "items": Record<string, string>[] }`  
  - Missing key: `503` with `error: "inventory_unavailable"`  
  - Upstream failure: `502` with a message

- **`GET /api/supporting-resources`**  
  - Success: `{ "categories": { id, title, contacts: { name, email }[] }[] }`  
  - Missing key: `503`  
  - Upstream failure: `502`

After deployment, test from a machine (not the phone):

```bash
curl -sS "https://YOUR_API_DOMAIN/api/healthz"
curl -sS "https://YOUR_API_DOMAIN/api/inventory" | head -c 500
curl -sS "https://YOUR_API_DOMAIN/api/supporting-resources" | head -c 500
```

---

## Production checklist (before App Store submission)

- [ ] **Google Sheets API** enabled; **API key** created and **restricted** (Sheets API; IP if possible).
- [ ] **`GOOGLE_SHEETS_API_KEY`** set on the **production** api-server; process restarted.
- [ ] **Spreadsheet** link sharing and **tab names** correct; **row 1** headers as expected.
- [ ] **`EXPO_PUBLIC_DOMAIN`** in EAS **production** profile = **production** API host (HTTPS).
- [ ] Smoke-test **`/api/inventory`** and **`/api/supporting-resources`** on that host.
- [ ] On a **release build** (or TestFlight), open **Supporting Resources** and **Equipment Inventory** and confirm data loads; use pull-to-refresh.
- [ ] No secrets in git, chat, or screenshots; if a key was ever pasted publicly, **rotate** it in Google Cloud.

---

## Troubleshooting

| Symptom | Likely cause |
|--------|----------------|
| App shows “Could not load inventory” / similar | `EXPO_PUBLIC_DOMAIN` wrong, API down, or no network. |
| `503` from API, message about missing key | `GOOGLE_SHEETS_API_KEY` not set on **this** server environment. |
| `403` / “API not enabled” | Enable **Google Sheets API** in the same Google Cloud project as the key. |
| `403` / permission | Key restrictions too tight, or wrong project; fix **API restrictions** and **IP** (if used). |
| Empty lists | Empty tabs, wrong tab names, or header row not row 1. |
| Data in Sheet but not in app | Wrong `GOOGLE_SHEETS_SPREADSHEET_ID`; or server still pointing at old default ID. |

---

## Summary

For a **production-ready, App Store** setup: keep **one** Google Sheet with the two tabs, protect **one** server-side **API key**, point **EAS production** at your **live API domain**, and verify the two `GET` routes on that domain before you ship. Optional hardening: IP-restrict the key, monitor `502`/`503` logs, and rotate keys on any suspected leak.
