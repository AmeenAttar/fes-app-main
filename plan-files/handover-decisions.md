# Engineering Decisions Handover

This document records significant architectural decisions, the alternatives that were considered, and where each decision is implemented. Consult this before making changes to any of the areas listed.

---

## Decision 1 — Expo Router (file-based routing) over React Navigation

**Decision:** Use Expo Router 6 with file-based routing.  
**Alternatives considered:** React Navigation v7 with a manually defined navigator.

**Rationale:**
- Expo Router integrates with the Expo ecosystem (deep linking, typed routes, web support).
- File-based routing reduces boilerplate and makes the screen structure visible from the file system.
- Typed routes (`experiments.typedRoutes: true` in `app.json`) provides compile-time safety.

**Implemented in:**
- `artifacts/fes-app/app/` — all screen files
- `artifacts/fes-app/app/_layout.tsx` — Stack navigator definition
- `artifacts/fes-app/app.json` → `plugins: ["expo-router"]`

**Do not change without reviewing:** Adding new screens requires both a file in `app/` AND a `<Stack.Screen>` entry in `_layout.tsx`. Typed routes are checked by the TypeScript compiler.

---

## Decision 2 — Server-side HTML Scraping for Investigators

**Decision:** The investigators list is fetched by HTML-scraping `fescenter.org/test/team/investigators/` on the API server.  
**Alternatives considered:**
- Exporting the investigator list to a Google Sheet or JSON file (rejected — requires ongoing manual maintenance).
- Using a WordPress REST API (the investigators are not WordPress CPT entries; they are in a custom page layout).
- Asking the FES Center for a data export API (rejected — not available).

**Rationale:**
- The website is the source of truth for investigator information.
- Scraping on the server side (not the client) avoids CORS issues and keeps the scraping logic centralised.
- 10-minute in-memory cache reduces load on the upstream site.

**Implemented in:**
- `artifacts/api-server/src/routes/investigators.ts` — full scraping logic with HTML entity decoding, bio extraction, slug generation

**Do not change without reviewing:** The HTML parser is regex-based and tightly coupled to the site's current DOM structure (`<div class="person">`, `<div class="person-name">`). Any change to the site's HTML will silently break parsing. Adding a structural change check (assert `investigators.length > 0`) is already in place; add additional assertions if the DOM structure becomes more complex.

---

## Decision 3 — Google Calendar iCal Feed for Events (not Google Calendar API)

**Decision:** Events are fetched from the public iCal feed (`calendar.google.com/ical/...`), not the Google Calendar API.  
**Alternatives considered:**
- Google Calendar API v3 (requires OAuth or service account credentials).
- AddEvent REST API (requires the team to have an AddEvent account and API key — planned for Task #3).

**Rationale:**
- The iCal feed is public and requires no credentials.
- `node-ical` handles iCal parsing including recurring event expansion.
- This was the fastest path to a working events list.

**Implemented in:**
- `artifacts/api-server/src/routes/events.ts` — iCal fetch, parse, recurring event expansion
- `artifacts/api-server/src/lib/notifications.ts` — reuses `loadEvents()` for push scheduling

**Do not change without reviewing:** The notification scheduler (`notifications.ts`) imports `loadEvents` from `events.ts` and shares its 5-minute cache. If you replace the events source (e.g. switch to AddEvent), you must update both files and ensure the `EventDto` contract is preserved, as push notifications depend on `event.uid`, `event.start`, and `event.allDay`.

---

## Decision 4 — Expo Push Service (not APNs directly)

**Decision:** Push notifications are delivered via Expo's Push Service, which wraps APNs (iOS) and FCM (Android).  
**Alternatives considered:**
- Direct APNs HTTP/2 integration (requires managing Apple certificates, no abstraction).
- Firebase Cloud Messaging (requires Google account and Firebase setup; also what Expo uses underneath for Android).

**Rationale:**
- `expo-server-sdk` provides a single send API for both iOS and Android.
- Expo manages APNs/FCM credentials and handles chunking, receipts, and error codes.
- Tightly integrated with the Expo build ecosystem.

**Implemented in:**
- `artifacts/api-server/src/lib/notifications.ts` — uses `expo-server-sdk`'s `Expo` class
- `artifacts/fes-app/lib/push.ts` — uses `expo-notifications` to get the push token

**Do not change without reviewing:** The push token format (`ExponentPushToken[...]`) is specific to Expo's service. Switching to direct APNs would require changing both the server sender and the client token format, and updating the `push_tokens` table.

---

## Decision 5 — In-Process Notification Scheduler (not a separate worker)

**Decision:** The 5-minute event reminder scheduler runs inside the same Node.js process as the Express API server.  
**Alternatives considered:**
- Separate worker process or cron job (rejected — adds deployment complexity).
- Separate Lambda/Cloud Function (rejected — overengineered for current scale).
- Database-backed queue like BullMQ (rejected — adds Redis dependency).

**Rationale:**
- Simple and deployable with zero additional infrastructure.
- The poll interval (5 minutes) is generous enough that scheduler overhead doesn't impact API latency.
- The unique index on `sent_notifications` prevents double-sending even if two instances race.

**Implemented in:**
- `artifacts/api-server/src/lib/notifications.ts` — `startNotificationScheduler()`
- `artifacts/api-server/src/index.ts` — calls `startNotificationScheduler()` at boot

**Revised August 2026 — the schedule can now also come from outside.** The
in-process timer holds only while the process stays alive, and every free
hosting tier suspends a service after a few idle minutes. A suspended process
fires no timers, so reminders would stop with nothing in the logs to show for
it — exactly the silent-failure shape this project keeps running into.

`runSchedulerOnce()` exposes a single pass, and `POST /api/tasks/run` triggers
it over HTTP. `.github/workflows/scheduler.yml` calls that every 10 minutes,
which both owns the cadence and keeps the service from idling. Set
`INTERNAL_SCHEDULER=off` wherever the external cron is in charge; leaving it on
is safe but duplicates work.

The original rationale still holds for anything self-hosted or always-on — this
is an added mode, not a replacement, and no queue or worker was introduced.

**The reminder windows were resized as a consequence, and this is the part worth
understanding before touching `REMINDERS`.** They were originally sized to the
5-minute in-process poll: `hour_before` fired between 50 and 75 minutes out, a
25-minute window that any 5-minute timer was certain to land in. An external
cron is not certain. GitHub delivers scheduled workflows on a best-effort basis
and observably skips ticks — gaps past 20 minutes were seen on day one — so an
event could pass clean through a 25-minute window and the reminder would never
send, with nothing logged.

`hour_before` now covers 0 to 75 minutes out and the title reports the real time
remaining (`formatLeadTime`), so a skipped tick *delays* the reminder instead of
losing it. This is only safe because the `sent_notifications` unique index, not
the window, is what guarantees once-per-occurrence — widening the window costs
nothing as long as that stays true.

Two consequences to keep in mind:

- A reminder may now read "Starting in 12 minutes" rather than "in 1 hour". That
  is the honest thing to say and the reason the copy is computed, not fixed.
- All-day events are excluded from `hour_before` entirely. They sit at local
  midnight, so a countdown would announce "Starting now" as the date rolled
  over. `day_before` is the only meaningful reminder for them.

**If you narrow these windows again, narrow them to the worst gap you are
willing to tolerate from your trigger, not to its nominal interval.**

**Do not change without reviewing:** If the server is scaled to multiple instances (e.g. multiple Replit replicas), each instance runs its own scheduler. The `sent_notifications` unique index prevents duplicate sends but does not prevent duplicate DB reads/writes. For more than 2 instances, move to a dedicated scheduler process.

---

## Decision 6 — TanStack React Query for All Data Fetching

**Decision:** All async data in the Expo app is managed by `@tanstack/react-query`.  
**Alternatives considered:**
- Raw `useEffect` + `useState` (rejected — no caching, no refetch, no deduplication).
- SWR (rejected — React Query is more featureful and already in the catalog).
- Zustand + custom fetch logic (rejected — unnecessary complexity).

**Rationale:**
- Provides automatic caching, background refetch, loading/error states, and deduplication.
- `useInfiniteQuery` will be used for paginated news feed (Task #2).
- Single `QueryClient` instance created in `_layout.tsx` and provided via context.

**Implemented in:**
- `artifacts/fes-app/app/_layout.tsx` — `QueryClient` + `QueryClientProvider`
- `artifacts/fes-app/app/investigators/index.tsx` — `useQuery`
- All future data-fetching screens should follow the same pattern.

**Do not change without reviewing:** `staleTime` is set per-query (`5 * 60 * 1000` for investigators). This determines how long cached data is considered fresh. Changing it globally affects all screens.

---

## Decision 7 — No Authentication

**Decision:** The app has no login screen or user identity.  
**Alternatives considered:**
- Replit Auth (OIDC) — not applicable outside Replit.
- Clerk — would add a login screen and user management.
- Apple SSO — possible but complex for internal distribution.

**Rationale:**
- The app is distributed internally via TestFlight/Apple Developer enrollment.
- Device possession is considered equivalent to authorization.
- Adding auth would significantly increase complexity and require a user database.
- The FES Center's IT policy was reviewed informally and this approach was deemed acceptable.

**Implemented in:** N/A — absence of auth middleware in `api-server/src/app.ts`.

**Critical unknown:** If the app ever includes sensitive patient data or PHI (Protected Health Information), authentication and HIPAA compliance become mandatory. The current architecture is not HIPAA-compliant. Do not add any patient-identifiable information to the app or API without a full security review.

---

## Decision 8 — Brand Colours Hard-Coded as Constants, not Theme Provider

**Decision:** Brand colours (`FES_BLUE`, `FES_TEAL`) are defined in `constants/colors.ts` and used directly; no theme/design-token provider.  
**Alternatives considered:**
- React Native Paper / styled-components theme provider (rejected — overengineered for current scope).
- CSS variables (not applicable to React Native).

**Rationale:**
- The app has a single light theme with a fixed palette.
- A theme provider would be warranted if dark mode or white-labelling is needed.
- `useColors()` hook (`hooks/useColors.ts`) already wraps `colors.light` — switching to a theme provider would only require updating that hook.

**Implemented in:**
- `artifacts/fes-app/constants/colors.ts`
- `artifacts/fes-app/hooks/useColors.ts`
- `artifacts/fes-app/app/menu.tsx` — some colours (`FES_TEAL_START`, `FES_TEAL_END`, `FES_BLUE`) are also local constants for the gradient

**Do not change without reviewing:** The gradient colours in `menu.tsx` are slightly different from `constants/colors.ts` (teal gradient uses `#00bfb5`→`#009f9a`, while `constants/colors.ts` has `#00b2a9`). This was an intentional design decision during the menu redesign to achieve a specific glass-depth visual effect.

---

## Critical Unknowns / Assumptions

1. **HIPAA / PHI** — The app is assumed to never contain Protected Health Information. If clinical trial data or patient contact info is ever added, a full HIPAA compliance review is required.

2. **Website HTML stability** — The investigators scraper assumes the `fescenter.org` DOM structure is stable. No contract or API agreement exists. A silent scraper failure (returning 0 investigators) is a real operational risk.

3. **URL migration timing** — The website is expected to migrate from `fescenter.org/test/*` to `fescenter.org/*`, but no timeline has been confirmed. All external URLs currently hardcoded to `/test/` will break after migration.

4. **AddEvent API access** — Task #3 (Events with AddEvent) assumes the FES Center has or will create an AddEvent account and provide an API key. This has not been confirmed.

5. **Google Sheets access model** — Task #4 (Inventory) assumes the team will create a publicly readable Google Sheet. If privacy requirements prevent public sheets, an OAuth flow or service account will be needed.

6. **EAS project ownership** — The `eas.json` has no project ID. Whoever runs `eas init` first will own the EAS project. Ensure this is done under the FES Center's organisational Expo account, not a personal account.

7. **Apple Developer account** — An Apple Developer account (`$99/year`) is required for TestFlight and App Store distribution. It is assumed the FES Center or a partner institution has one. It must be the same team that provides `appleTeamId` in `eas.json`.

---

## Do Not Change Without Reviewing

| Area | Risk | Review With |
|---|---|---|
| `api-server/src/routes/events.ts` — `loadEvents()` and `EventDto` shape | The notification scheduler imports this directly; changing the shape breaks push notifications | `api-server/src/lib/notifications.ts` |
| `lib/db/src/schema/push.ts` — table schema | Changing column names or types requires a Drizzle migration; forgetting the migration will crash the API on next deploy | `lib/db/drizzle.config.ts`, run `drizzle-kit generate` then `drizzle-kit migrate` |
| `artifacts/fes-app/app.json` — `ios.bundleIdentifier` | Changing the bundle ID invalidates all existing push tokens, provisioning profiles, and breaks App Store continuity | Never change after first TestFlight submission |
| `artifacts/fes-app/constants/menu.ts` — `MENU_BLOCKS` order | The `menu.tsx` renders rows as fixed pairs `[0,1]`, `[2,3]`, `[4,5]` — reordering items changes the visual grid without any type error | `artifacts/fes-app/app/menu.tsx` lines defining `rows` |
| `api-server/src/lib/notifications.ts` — `REMINDERS` windows | Changing `minMinutes`/`maxMinutes` changes when investigators receive push notifications | Test with a real upcoming event before deploying |
| `lib/api-spec/openapi.yaml` — `info.title` | Orval uses the title to generate output filenames. Changing it breaks all import paths for generated files | `lib/api-spec/orval.config.ts`, `lib/api-client-react/src/generated/`, `lib/api-zod/src/generated/` |
