# Technical Handover — Cleveland FES Center App

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Replit Workspace                          │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │   artifacts/fes-app   │    │   artifacts/api-server        │   │
│  │   (Expo / RN)         │    │   (Express 5 / Node ESM)      │   │
│  │   Port: $PORT (Expo)  │◄──►│   Port: $PORT (8080)         │   │
│  │   Served via Expo CLI │    │   Served via esbuild bundle   │   │
│  └──────────────────────┘    └───────────┬──────────────────┘   │
│                                           │                      │
│  ┌───────────────────────────────────────┘                      │
│  │  lib/db  (Drizzle ORM + PostgreSQL)                          │
│  │  lib/api-spec  (OpenAPI YAML)                                │
│  │  lib/api-zod   (Zod schemas, generated)                      │
│  │  lib/api-client-react  (React Query hooks, generated)        │
│  └──────────────────────────────────────────────────────────────┘
│                                                                  │
│  Reverse proxy (Replit) routes all traffic on port 80:           │
│    /api/* → api-server                                           │
│    /* → fes-app Expo server                                      │
└─────────────────────────────────────────────────────────────────┘

External dependencies:
  fescenter.org/test/*       ← HTML scraping (investigators)
  calendar.google.com        ← iCal feed (events + push scheduler)
  fcm.googleapis.com         ← Firebase/Expo push delivery
  exp.host/--/api/v2/push    ← Expo Push Service
  Replit PostgreSQL           ← push_tokens, sent_notifications
```

---

## Monorepo Package Map

```
/
├── artifacts/
│   ├── fes-app/                      @workspace/fes-app
│   │   ├── app/                      Expo Router file-based routes
│   │   │   ├── _layout.tsx           Root layout: QueryClient, fonts, push registration
│   │   │   ├── index.tsx             Redirect to /menu
│   │   │   ├── menu.tsx              6-tile grid + CTA bar
│   │   │   ├── investigators/
│   │   │   │   ├── index.tsx         Searchable list
│   │   │   │   └── [slug].tsx        Detail view
│   │   │   ├── events/
│   │   │   │   └── index.tsx         Upcoming events list
│   │   │   ├── equipment-inventory.tsx   STUB — placeholder
│   │   │   ├── supporting-resources.tsx  Static contact list
│   │   │   └── tuesdays.tsx          STUB — placeholder
│   │   ├── components/
│   │   │   ├── AppHeader.tsx         Custom stack header (FES branded)
│   │   │   ├── ComingSoon.tsx        Placeholder for unbuilt screens
│   │   │   ├── ErrorBoundary.tsx     Top-level React error boundary
│   │   │   ├── ErrorFallback.tsx     Fallback UI for errors
│   │   │   ├── HamburgerMenu.tsx     Overlay nav drawer
│   │   │   └── KeyboardAwareScrollViewCompat.tsx
│   │   ├── constants/
│   │   │   ├── colors.ts             Brand palette (FES blue, teal, text)
│   │   │   ├── menu.ts               MENU_BLOCKS config (6 tiles)
│   │   │   └── supporting-resources.ts  Static resource contacts
│   │   ├── hooks/
│   │   │   └── useColors.ts          Returns colors.light (no dark mode yet)
│   │   ├── lib/
│   │   │   ├── api.ts                fetch helpers + type definitions
│   │   │   ├── push.ts               Push permission + token registration
│   │   │   └── rsvp.ts               (Stub / future RSVP logic)
│   │   └── app.json / eas.json       Expo + EAS config
│   │
│   └── api-server/                   @workspace/api-server
│       └── src/
│           ├── app.ts                Express app setup (cors, pino-http, routes)
│           ├── index.ts              Entry point: HTTP server + notification scheduler
│           └── routes/
│               ├── index.ts          Router aggregator
│               ├── health.ts         GET /healthz
│               ├── investigators.ts  GET /investigators, GET /investigators/:slug
│               ├── events.ts         GET /events  (iCal parser)
│               └── push.ts           POST /push-tokens, DELETE /push-tokens/:token
│           └── lib/
│               ├── logger.ts         Pino singleton logger
│               └── notifications.ts  5-minute scheduler, Expo Push sender
│
├── lib/
│   ├── api-spec/                     @workspace/api-spec
│   │   └── openapi.yaml              OpenAPI 3.1 contract (only /healthz currently)
│   ├── api-client-react/             @workspace/api-client-react
│   │   └── src/generated/api.ts      Orval-generated React Query hooks
│   ├── api-zod/                      @workspace/api-zod
│   │   └── src/generated/            Orval-generated Zod schemas
│   └── db/                           @workspace/db
│       ├── src/schema/push.ts        push_tokens + sent_notifications tables
│       └── drizzle.config.ts         Points to DATABASE_URL
│
└── pnpm-workspace.yaml               Workspace + catalog pins
```

---

## Runtime Environment Variables

### api-server (set in Replit Secrets or deployment env)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (Replit managed) |
| `PORT` | **Yes** | — | HTTP port the server binds to (Replit sets this) |
| `SESSION_SECRET` | Yes | — | Express session secret (currently only required by middleware; no session routes yet) |
| `NODE_ENV` | No | `development` | Set to `production` for deployed environments |

**Planned env vars (not yet implemented — see Task #1 and Task #3):**

| Variable | Description |
|---|---|
| `FESCENTER_BASE_URL` | Base URL for FES Center website scraping (default: `https://fescenter.org/test`) |
| `ADDEVENT_API_KEY` | AddEvent REST API v2 bearer token (Task #3) |

**Google Sheets (implemented):** `GOOGLE_SHEETS_API_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID` / `INVENTORY_SHEET_ID`, `INVENTORY_SHEET_NAME` (default `Equipment`), `SUPPORTING_RESOURCES_SHEET_NAME` (default `Supporting Resources`). Full production steps: `handover-google-sheets-production.md`.

### fes-app (Expo, set in eas.json or .env)

| Variable | Required | Default | Description |
|---|---|---|---|
| `EXPO_PUBLIC_DOMAIN` | **Yes** | — | Domain of the deployed API server (no trailing slash). Used to build `API_BASE_URL` in `lib/api.ts`. Example: `myapp.replit.app` |
| `EXPO_PACKAGER_PROXY_URL` | Dev only | — | Set automatically by the Expo dev script in Replit to route metro through the Replit proxy |
| `PORT` | Dev only | — | Port Expo CLI binds to (set by Replit) |

---

## API Endpoints and Contracts

Base path: `/api` (all routes mount under this prefix via Replit's reverse proxy).

### `GET /api/healthz`
Returns server health.  
**Response:** `200 { "status": "ok" }`  
Defined in: `api-server/src/routes/health.ts`, spec in `lib/api-spec/openapi.yaml`.

### `GET /api/investigators`
Scrapes and returns all FES Center investigators.  
**Response:** `200 { investigators: Investigator[], cached: boolean }`  
**Investigator shape:**
```ts
{
  slug: string;          // URL-safe identifier, e.g. "ajiboye-a-bolu-phd"
  name: string;          // Full name with credentials
  photoUrl: string|null; // Absolute URL to headshot image
  detailUrl: string;     // Source page URL on fescenter.org
}
```
**Cache:** 10-minute in-memory cache per list. TTL resets on successful refetch.  
**Error:** `502` if upstream HTML fetch or parse fails.  
Defined in: `api-server/src/routes/investigators.ts`.

### `GET /api/investigators/:slug`
Returns full detail for one investigator.  
**Response:** `200 { investigator: InvestigatorDetail, cached: boolean }`  
**InvestigatorDetail shape** extends Investigator:
```ts
{
  title: string|null;       // Academic/professional title paragraph
  bio: string[];            // Paragraph-level text from page
  heroImageUrl: string|null // Best photo from the detail page
}
```
**Cache:** 10-minute in-memory per slug.  
**Error:** `404` if slug not found in list; `502` on upstream failure.

### `GET /api/events`
Returns upcoming FES Center events parsed from Google Calendar iCal feed.  
**Feed URL:** `https://calendar.google.com/calendar/ical/fescalendar%40fescenter.org/public/basic.ics`  
**Response:** `200 { events: EventDto[] }`  
**EventDto shape:**
```ts
{
  id: string;             // uid (or uid_occurrenceISO for recurring)
  uid: string;            // Stable calendar UID (no occurrence suffix)
  title: string;
  description: string|null;
  location: string|null;
  start: string;          // ISO 8601
  end: string|null;       // ISO 8601
  allDay: boolean;
  htmlLink: string|null;  // Currently always null (iCal feed limitation)
}
```
**Filtering:** Upcoming only (now → now+365 days). Recurring events expanded. Max 100 events returned.  
**Cache:** 5-minute in-memory.  
Defined in: `api-server/src/routes/events.ts`.

### `POST /api/push-tokens`
Registers or updates a device push token.  
**Body:** `{ token: string, platform: "ios"|"android"|"web" }`  
**Validation:** Must be a valid Expo push token (`ExponentPushToken[...]` format).  
**Upsert:** Conflict on `token` column updates `platform` and `updatedAt`.  
**Response:** `200 { ok: true }`  
Defined in: `api-server/src/routes/push.ts`.

### `DELETE /api/push-tokens/:token`
Removes a push token (e.g. on logout or permission revoke).  
**Response:** `200 { ok: true }`

---

## Data Models

### PostgreSQL (Drizzle ORM, `lib/db`)

**`push_tokens`**
```sql
id           SERIAL PRIMARY KEY
token        TEXT NOT NULL UNIQUE          -- Expo push token string
platform     TEXT NOT NULL                 -- 'ios' | 'android' | 'web'
created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

**`sent_notifications`**
```sql
id                SERIAL PRIMARY KEY
event_uid         TEXT NOT NULL            -- Stable calendar UID
occurrence_start  TIMESTAMPTZ NOT NULL     -- Specific occurrence date/time
kind              TEXT NOT NULL            -- 'day_before' | 'hour_before'
sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
UNIQUE INDEX on (event_uid, occurrence_start, kind)
```
The unique index prevents duplicate reminders if the scheduler runs more than once in the same window.

### In-memory caches (api-server)

| Cache | TTL | Structure |
|---|---|---|
| Investigator list | 10 min | `Map<url, { data, fetchedAt }>` |
| Investigator detail | 10 min | `Map<slug, { data, fetchedAt }>` |
| Events (iCal) | 5 min | Single `{ ts, data }` object |

Caches are **per-process** and reset on server restart. There is no Redis or shared cache.

### AsyncStorage (fes-app, on-device)

| Key | Value | Purpose |
|---|---|---|
| `@fes/push-token-v1` | Expo push token string | Prevents redundant token re-registration |

---

## Background Jobs / Schedulers

### Notification Scheduler (`api-server/src/lib/notifications.ts`)

- Started at server boot (`startNotificationScheduler()` in `src/index.ts`).
- Runs `processOnce()` once immediately, then every **5 minutes** via `setInterval`.
- **Logic per tick:**
  1. Load events from the iCal feed (uses the same 5-minute cache as the `/api/events` route).
  2. Load all push tokens from the database.
  3. For each event × each reminder window:
     - `day_before`: fires when `18h ≤ event.start - now ≤ 30h`
     - `hour_before`: fires when `50min ≤ event.start - now ≤ 75min`
  4. Check `sent_notifications` table; skip if already sent.
  5. Send push notification via Expo Push Service (chunked batch API).
  6. Insert row into `sent_notifications`.
  7. On `DeviceNotRegistered` ticket error: delete the stale token from `push_tokens`.

- **Idempotent:** The unique index on `sent_notifications` prevents double-send even if two instances race.
- **No separate worker process:** The scheduler runs inside the same Express process as the API.

---

## Auth / Security Assumptions

- **No user authentication.** The app has no login. Access is by device possession (TestFlight invite).
- **No API authentication.** The API server has no auth middleware. All endpoints are publicly accessible at the Replit proxy URL. This is acceptable for an internal app but should be reviewed before any sensitive data is served.
- **`SESSION_SECRET`** is set in Replit Secrets and available to the server, but no session middleware or session routes exist yet.
- **CORS** is enabled with default settings (all origins) — appropriate for Expo dev builds which make requests from `localhost` or `exp://`.
- **HTTPS only in production.** Replit enforces HTTPS on its proxy domain. Local Expo dev traffic uses HTTP/WS.
- **iCal feed is public.** The Google Calendar used is publicly shared. The API server does not add authentication when fetching it.
- **Investigators website is public.** The scraping uses browser-like User-Agent headers but no credentials.

---

## Push Notification Flow — End to End

```
1. App boots (app/_layout.tsx)
   └─ calls registerForPushNotifications() [lib/push.ts]
       ├─ Checks: Platform !== "web", Device.isDevice === true
       ├─ Requests iOS permission via Notifications.requestPermissionsAsync()
       ├─ Calls Notifications.getExpoPushTokenAsync({ projectId })
       │    └─ projectId comes from app.json → extra.eas.projectId
       │       (currently placeholder — must be set via `eas init`)
       ├─ If token differs from AsyncStorage cache:
       │    POST /api/push-tokens { token, platform }
       │    └─ Upserted into push_tokens DB table
       └─ Stores token in AsyncStorage @fes/push-token-v1

2. Server scheduler tick (every 5 min)
   └─ processOnce() [api-server/lib/notifications.ts]
       ├─ loadEvents() → fetches iCal, returns next 365d of events
       ├─ SELECT * FROM push_tokens
       ├─ For each event × reminder window:
       │    ├─ minutesUntil = (event.start - now) / 60000
       │    ├─ Match day_before window [1080..1800 min] or hour_before [50..75 min]
       │    ├─ SELECT from sent_notifications WHERE uid+occurrence+kind
       │    │   → skip if row exists
       │    ├─ Build push message payload
       │    ├─ Expo.chunkPushNotifications() + sendPushNotificationsAsync()
       │    └─ INSERT into sent_notifications (idempotent on conflict)
       └─ Stale token cleanup: DELETE push_tokens WHERE token = invalidToken

3. Expo Push Service → APNs → iOS device
   └─ Notification appears if app is foregrounded: banner + sound (configured
      via setNotificationHandler in lib/push.ts)
```
