# Product Handover — Cleveland FES Center App

## App Overview

The Cleveland FES Center app is an **internal mobile application** for investigators, researchers, and staff of the Cleveland Functional Electrical Stimulation (FES) Center — a 30-year-old trans-disciplinary alliance of scientists and clinicians specialising in neuromodulation research (using low-level electrical currents to restore function in people with disabilities).

The app is **iOS-first**, portrait-only. Android is configured but not the primary target.

**Bundle ID:** `org.fescenter.app`  
**Expo slug:** `fes-app`  
**Target users:** FES Center investigators, staff, and consortium partners — not the general public, not patients.

---

## Key Workflows

### 1. Launch → Home → Menu
- App opens with a white splash screen showing the FES logo.
- Redirects immediately to the Menu screen (`/menu`).
- The `index` route (`app/index.tsx`) exists only to redirect to `/menu`.

### 2. Menu Navigation
- 2×3 grid of teal gradient tiles + a blue CTA bar at the bottom.
- Each tile navigates to an internal screen or opens an external URL in an in-app browser sheet.
- The hamburger icon (top right) opens a side navigation overlay (HamburgerMenu component).
- The CTA bar ("Contact Cheryl Dudek") opens `mailto:cdudek@fescenter.org`.

### 3. Investigators Directory
- Fetches and scrapes the list of investigators from `fescenter.org/test/team/investigators/`.
- Shows a searchable list with avatar photo and name.
- Tapping a row navigates to a detail screen (`/investigators/[slug]`) which scrapes the individual investigator page.
- Cache TTL: 10 minutes per investigator (both list and detail).

### 4. Events
- Fetches events from the FES Center's public Google Calendar iCal feed.
- Shows upcoming events (next 365 days); recurring events are expanded per occurrence.
- Push notifications fire 1 day before and 1 hour before each event.

### 5. Push Notifications
- On app launch, the app requests push permission and registers the device token with the API server.
- The API server runs a scheduler (every 5 minutes) that checks upcoming events and sends push reminders via Expo Push Service.
- Token is cached in AsyncStorage; re-registration only happens when the token changes.

### 6. Supporting Resources
- Static list of contacts for internal services (budgets, communications, medical illustration, FDA support, etc.).
- Tapping a contact opens `mailto:`.

---

## Completed Features

| Feature | Status | Where |
|---|---|---|
| Splash screen with FES logo | ✅ Done | `app.json` splash config |
| Menu screen — teal tile grid | ✅ Done | `app/menu.tsx` |
| Menu screen — blue CTA bar (Contact Cheryl Dudek) | ✅ Done | `app/menu.tsx` |
| Hamburger nav overlay | ✅ Done | `components/HamburgerMenu.tsx` |
| Investigators list with search | ✅ Done | `app/investigators/index.tsx` |
| Investigator detail view | ✅ Done | `app/investigators/[slug].tsx` |
| Events list (Google Calendar iCal) | ✅ Done | `app/events/index.tsx` + `api-server/routes/events.ts` |
| Push token registration | ✅ Done | `lib/push.ts` + `api-server/routes/push.ts` |
| Push notification scheduler (day-before + hour-before) | ✅ Done | `api-server/lib/notifications.ts` |
| Supporting Resources contact list | ✅ Done | `app/supporting-resources.tsx` |
| Inter font family (400/500/600/700) | ✅ Done | `app/_layout.tsx` |
| React Query for all data fetching | ✅ Done | `app/_layout.tsx` (QueryClientProvider) |
| Brand colours (FES blue #0069a6, teal #00b2a9) | ✅ Done | `constants/colors.ts` |
| Error boundary | ✅ Done | `components/ErrorBoundary.tsx` |
| DB schema: push_tokens + sent_notifications | ✅ Done | `lib/db/src/schema/push.ts` |

---

## Planned Features (Drafted as Project Tasks)

| Task | Priority | Notes |
|---|---|---|
| **#1 — Project docs & URL migration config** | High | Centralise `FESCENTER_BASE_URL` env var; write AGENT.md |
| **#2 — News feed screen** | High | WP REST API, 10 posts, infinite scroll; convert News tile to internal route |
| **#3 — Events with AddEvent** | Medium | AddEvent REST API v2 integration; RSVP/Add-to-Calendar button |
| **#4 — Equipment Inventory via Google Sheets** | Medium | Dynamic Google Sheet reader; search/filter |
| Clinical Trials directory | Suggested | Filter by condition, show recruitment status |
| Funding Opportunities feed | Suggested | Surface WP posts tagged "awards" |
| Contact directory | Suggested | Key admin contacts with one-tap email/call |

---

## Known UX / Product Decisions & Tradeoffs

### External links open in in-app sheet, not system browser
`expo-web-browser` `openBrowserAsync` with `PAGE_SHEET` presentation is used for external URLs (currently only News in the old config). This keeps users inside the app experience without ejecting them to Safari.

### News tile was external; becoming internal
The "News" menu block currently sends users to `https://fescenter.org/blog/` via browser. Task #2 will change this to an internal screen using the WordPress REST API. The old external URL is in `constants/menu.ts`.

### Investigators list is scraped, not a real API
The investigators route (`api-server/routes/investigators.ts`) HTML-scrapes the FES Center website. This is intentional — the website is the source of truth and there is no investigator API. The scraper is robust (HTML entity decoding, heading extraction, bio parsing) but will break if the website's HTML structure changes significantly.

### Push notifications require a real device and a development build
Expo Go does **not** support push tokens. A development build (`expo-dev-client`) must be installed on a real iOS or Android device. The `push.ts` library handles this gracefully (returns `status: "unsupported"` on simulator/Expo Go).

### `eas.json` has placeholder values
`EAS projectId`, `appleId`, `ascAppId`, and `appleTeamId` are all placeholder strings (`REPLACE_WITH_*`). No real EAS builds or App Store submissions are possible until these are filled in.

### Website URL migration pending
All content (investigators, events, news) is currently fetched from `fescenter.org/test/*`. The FES Center plans to migrate to `fescenter.org/*` (dropping `/test/`). The migration is not yet complete. When it happens, a single env var change should be sufficient — but this has not yet been implemented as a config constant (it is Task #1).

### No authentication in the app
The app has no login screen. It is distributed internally via TestFlight / Apple Developer enrollment. The assumption is that device possession = authorization. There is no user identity in the system.

### Tuesdays screen and Equipment Inventory are stubs
Both `app/tuesdays.tsx` and `app/equipment-inventory.tsx` exist but render placeholder/coming-soon UI. They are the next screens to be built.
