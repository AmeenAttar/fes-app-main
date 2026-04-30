# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- **`artifacts/api-server`** — Express 5 API.
  - `/api/investigators` and `/api/investigators/:slug` scrape the Cleveland FES Center
    WordPress site (`https://fescenter.org/test/team/investigators/`) for the investigator list
    and detail pages (title, hero image, bio paragraphs). Cached 10 minutes in-memory.
  - `/api/events` parses the FES Center public Google Calendar iCal feed (`fescalendar@fescenter.org`)
    using `node-ical`, expands recurring events, and returns upcoming events for the next year.
    Cached 5 minutes in-memory.
  - `/api/push-tokens` (POST/DELETE) — registers/removes Expo push tokens (validated with
    `expo-server-sdk`'s `Expo.isExpoPushToken`) into the `push_tokens` table.
  - **Notification scheduler** (`src/lib/notifications.ts`) — runs once at startup then every
    5 minutes; sends "Tomorrow at the FES Center" reminders 18–30 hours before each event,
    and "Starting in 1 hour" reminders 50–75 minutes before. Uses the `sent_notifications`
    table (uniqueIndex on `event_uid + occurrence_start + kind`) to dedupe so each reminder
    fires exactly once per occurrence. Tokens that come back `DeviceNotRegistered` from
    Apple/Google are auto-removed.
- **`artifacts/fes-app`** — Internal Expo mobile app for FES Center investigators and staff.
  - Brand palette pulled from the official site CSS: blue `#0069a6`, teal `#00b2a9`,
    text `#1f2937`, muted `#4b5563` (`constants/colors.ts`).
  - Splash (`app/index.tsx`) — animated logo fade, then routes to `/menu`.
  - Menu (`app/menu.tsx`) — 6 teal cards (News, Events, Investigators, Supporting Resources,
    Equipment Inventory, Sign Up for Tuesdays!) plus a blue CTA bar that opens an email to
    Cheryl Dudek for project concept reviews.
  - Investigators (`app/investigators/index.tsx`, `[slug].tsx`) — searchable list + bios pulled live.
  - Events (`app/events/index.tsx`) — calendar events with Going / Interested / Not Going RSVP
    stored locally via `@react-native-async-storage/async-storage` (`lib/rsvp.ts`).
  - Supporting Resources (`app/supporting-resources.tsx`) — internal contact directory grouped by
    category (data in `constants/supporting-resources.ts`); emails open `mailto:` links.
  - Equipment Inventory and Sign Up for Tuesdays! are placeholder screens (`components/ComingSoon.tsx`)
    awaiting source data / form requirements.
  - News opens fescenter.org/blog via `expo-web-browser` (in-app browser sheet).
  - Custom `components/AppHeader.tsx` replaces the default Stack header so titles always
    sit just below the iPhone camera cutout / dynamic island (matches the menu page's
    safe-area math). Hamburger button (`components/HamburgerMenu.tsx`) is on the right
    of every screen and opens a full-screen blue navigation panel.
  - Push notifications: `lib/push.ts` requests permission on app start, fetches an Expo
    push token via `Notifications.getExpoPushTokenAsync({ projectId })`, and POSTs it to
    `/api/push-tokens`. Token is cached in AsyncStorage so we only re-register when it
    changes. Requires a development build (not Expo Go) — see EAS Build steps below.

## EAS Build / Push notifications setup

Push notifications require an iOS development build distributed via TestFlight or direct
install. **One-time setup steps (run from `artifacts/fes-app/`):**

1. Install EAS CLI on your local machine: `npm install -g eas-cli`
2. `eas login` (with your Expo account; create one at expo.dev if needed)
3. `eas init` — links the project and writes the real `extra.eas.projectId` into `app.json`
   (replacing the `REPLACE_WITH_EAS_PROJECT_ID` placeholder).
4. Deploy the API server (Replit deployment) and copy the production domain
   (e.g. `your-app.replit.app`). Update `eas.json` → replace
   `REPLACE_WITH_DEPLOYED_API_DOMAIN` in all three build profiles with that domain.
5. `eas credentials` (or let EAS Build prompt) — provide:
   - Apple Team ID
   - APNs Auth Key (.p8) — generate at
     https://developer.apple.com/account/resources/authkeys (one-time, reusable for all apps).
     EAS uploads it once and reuses it for every future build.
6. `eas build --profile development --platform ios` — produces an `.ipa` you can install
   directly on a registered device (or distribute via TestFlight).

For App Store submission later, fill in the `submit.production.ios` placeholders in
`eas.json` and run `eas submit --profile production --platform ios`.
