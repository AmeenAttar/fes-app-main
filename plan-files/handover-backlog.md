# Backlog & Technical Debt Handover

## Prioritised Backlog

Severity: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low  
Effort: S = ~1 day, M = 2–3 days, L = 4–7 days

---

### Active Project Tasks (Drafted, Awaiting Execution)

| # | Task | Severity | Effort | Dependency |
|---|---|---|---|---|
| #1 | Project docs & URL migration config | 🟠 High | S | — |
| #2 | News feed screen (WP REST API, infinite scroll) | 🟠 High | M | #1 |
| #3 | Events screen with AddEvent RSVP | 🟡 Medium | M | #1 |
| #4 | Equipment inventory via Google Sheets | 🟡 Medium | M | #1 |

---

### Bugs

| ID | Description | Severity | Effort | File |
|---|---|---|---|---|
| B-001 | Push notifications silently fail if EAS projectId is placeholder | 🟠 High | S | `artifacts/fes-app/app.json`, `lib/push.ts` |
| B-002 | Investigators scraper breaks if fescenter.org changes HTML structure | 🟠 High | M | `api-server/src/routes/investigators.ts` |
| B-003 | Events `htmlLink` is always `null` (iCal feed has no Google Calendar link) | 🟡 Medium | S | `api-server/src/routes/events.ts` |
| B-004 | No deduplication of investigators with same slug from different pages | 🟢 Low | S | `api-server/src/routes/investigators.ts` |
| B-005 | `tuesdays.tsx` is a stub — tapping the menu tile shows placeholder | 🟡 Medium | M | `artifacts/fes-app/app/tuesdays.tsx` |
| B-006 | `equipment-inventory.tsx` is a stub — no data, no UI | 🟠 High | M | `artifacts/fes-app/app/equipment-inventory.tsx` |
| B-007 | News tile in menu opens external browser (should be internal screen) | 🟠 High | S | `artifacts/fes-app/constants/menu.ts` |
| B-008 | In-memory cache resets on every server restart — cold start hits all external URLs | 🟢 Low | M | `api-server/src/routes/investigators.ts`, `events.ts` |

---

### Technical Debt

| ID | Description | Severity | Effort | File |
|---|---|---|---|---|
| TD-001 | `fescenter.org/test` base URL is hardcoded in multiple places | 🟠 High | S | `api-server/src/routes/investigators.ts` (SOURCE_URL constant) |
| TD-002 | OpenAPI spec only covers `/healthz` — most routes not in contract | 🟡 Medium | M | `lib/api-spec/openapi.yaml` |
| TD-003 | No API authentication (all endpoints publicly accessible) | 🟠 High | M | `api-server/src/app.ts` |
| TD-004 | No error monitoring / alerting (no Sentry, no alerting) | 🟡 Medium | M | `api-server/src/lib/logger.ts` |
| TD-005 | `lib/api.ts` defines types manually that should come from generated `api-client-react` | 🟢 Low | M | `artifacts/fes-app/lib/api.ts` |
| TD-006 | No dark mode support (only `colors.light` exists, `useColors` always returns light) | 🟢 Low | S | `artifacts/fes-app/hooks/useColors.ts` |
| TD-007 | No tests anywhere — unit, integration, or E2E | 🟡 Medium | L | Entire codebase |
| TD-008 | `rsvp.ts` in fes-app is a stub/empty file | 🟢 Low | S | `artifacts/fes-app/lib/rsvp.ts` |
| TD-009 | `api-server` CORS allows all origins — should restrict to known domains in production | 🟡 Medium | S | `api-server/src/app.ts` |
| TD-010 | Notification scheduler shares process with API — heavy calendar polling can impact API latency | 🟢 Low | L | `api-server/src/lib/notifications.ts` |
| TD-011 | `expo-dev-client` is in `dependencies` not `devDependencies` in fes-app | 🟢 Low | S | `artifacts/fes-app/package.json` |

---

### Missing Features (Not Yet Tasked)

| Feature | Priority | Rationale |
|---|---|---|
| Clinical Trials directory | 🟡 Medium | Investigators track which studies are recruiting |
| Funding Opportunities feed | 🟡 Medium | Pilot awards, VA ORD grants — high-value internal info |
| Contact directory | 🟡 Medium | Key admin contacts already in supporting-resources, needs a proper UI |
| Investigator profile — research tags / institution filter | 🟢 Low | Useful for large investigator directory |
| "What is FES?" onboarding screen | 🟢 Low | Useful for new investigators and visiting researchers |
| Settings screen (notification preferences, app version) | 🟡 Medium | Users need a way to opt out of push notifications |
| Offline mode / graceful degradation | 🟢 Low | App is entirely network-dependent |

---

## First 10 Tasks for a New Developer

Follow this order to get productive quickly:

1. **Read all handover docs** — Start here. HANDOVER_PRODUCT.md → HANDOVER_TECH.md → HANDOVER_SETUP.md.
2. **Run locally** — Follow HANDOVER_SETUP.md. Get the API server and Expo app running. Verify `/api/healthz`, the investigators list, and the events list load.
3. **Fix TD-001** — Centralise `FESCENTER_BASE_URL` as an env var. This unblocks URL migration and is required before building any new data-fetch features (it is Task #1).
4. **Build the News Feed screen** (Task #2) — This is the highest-value user-visible feature that is missing. WP REST API is working; the proxy route just needs to be written.
5. **Fix B-007** — Change the News menu tile from `external` to `internal` after Task #2 is done. Single line change in `constants/menu.ts`.
6. **Build Events with AddEvent** (Task #3) — Requires an AddEvent API key from the FES Center team. Coordinate with managers to get access.
7. **Build Equipment Inventory** (Task #4) — Requires the team to set up a Google Sheet and share it publicly. Get the Sheet ID and tab name from them.
8. **Fill in `eas.json` placeholders** — Run `eas init`, collect Apple credentials, update `eas.json`. This unblocks any device testing and eventual App Store submission.
9. **Fix TD-003** — Add basic API authentication (even a simple bearer token checked against an env var) to prevent public access to the API.
10. **Add error monitoring** (TD-004) — Integrate a basic logging/alerting solution so you know when the investigators scraper or iCal fetch breaks in production.

---

## Known Limitations

- The app is **iOS-only** in practice. Android is configured in `app.json` but has not been tested or built.
- The app requires **internet access** at all times. There is no offline caching beyond React Query's in-memory cache (which resets on app restart).
- The investigators scraper is **fragile by nature**. Any change to the `fescenter.org` site HTML could silently break the list. Consider adding a monitoring alert for when the scraper returns 0 results.
- The notification scheduler does not handle **time zones** for all-day events correctly — it uses UTC, but events at the FES Center are in `America/New_York`. All-day event reminders may fire at unexpected times.
- No **user settings or preferences** exist. All users receive the same notifications and see the same data.

