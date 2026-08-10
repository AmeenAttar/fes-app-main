# Maintaining the Cleveland FES Center app

Written for whoever inherits this — including a future you who has forgotten the
details. It covers what the system is, how to keep it running, what breaks and
why, and how to change things without discovering the consequences in
production.

Companion documents:

- `handover-deployment.md` — hosting, environment variables, the cron runbook
- `handover-decisions.md` — why things are built the way they are
- `handover-privacy.md` — what the app collects, and the App Store declarations
- `handover-Product.md` — screen-by-screen product intent

---

## 1. What this system is

An iOS app for the Cleveland FES Center, plus a small API that feeds it.

```
Google Calendar (iCal) ─┐
fescenter.org (HTML)   ─┼─► api-server (Render) ─► Neon Postgres
WordPress REST API     ─┤        ▲                    │
open-meteo             ─┘        │                    │
                                 │              push_tokens
   iPhone app ───────────────────┘              sent_notifications
                                                news_push_state
   cron-job.org / GitHub Actions ──► POST /api/tasks/run
                                          │
                                          └─► Expo Push ─► APNs ─► iPhone
```

**The Center's website is the database.** There is no CMS for the app, no admin
panel, and no content table. Investigators, equipment, supporting resources, and
news are scraped or fetched from `fescenter.org` on every cache miss. Events come
from a public Google Calendar iCal feed. Staff update the app by updating the
website — which is a feature, not an oversight: nobody has to learn a second
system.

The consequence is that **the app's correctness depends on someone else's HTML.**
See §5.

### Repository layout

| Path | What it is |
|---|---|
| `artifacts/api-server` | Express API. ~3,750 lines. The scrapers live here. |
| `artifacts/fes-app` | Expo / React Native app. ~9,500 lines. |
| `lib/db` | Drizzle schema. Three tables, ~90 lines. |
| `artifacts/mockup-sandbox` | Design explorations. **Not shipped.** Fails typecheck; ignore it. |
| `plan-files` | These documents. |

### Hosting

| Service | Plan | Holds |
|---|---|---|
| Render | Free | `api-server` at `fes-api.onrender.com` |
| Neon | Free | Postgres, AWS `us-east-2` |
| cron-job.org | Free | Primary scheduler trigger |
| GitHub Actions | Free | Backup scheduler trigger |
| Expo EAS | Free | Builds, OTA updates, environment variables |

All free tiers with no card. That constraint drove several design decisions;
`handover-decisions.md` explains which.

---

## 2. Routine operations

### Deploying the API

Merge to `main`. Render builds and deploys automatically, ~3 minutes. There is
no staging environment — `main` is production.

Before merging anything that touches `api-server`:

```bash
pnpm run typecheck && pnpm --filter @workspace/api-server run test && pnpm --filter @workspace/api-server run build
```

**Use the root `typecheck`, not the per-package one.** `lib/db` is a composite
TypeScript project that emits declarations to `lib/db/dist`, and the other
packages type-check against those emitted files rather than its source. Running
only `pnpm --filter @workspace/api-server run typecheck` checks against
*whatever was emitted last* — so a change to `lib/db` appears to pass, or fails
for reasons that no longer exist. The root script runs `tsc --build` first,
which regenerates them.

`lib/db/dist` is gitignored, so a fresh clone has no declarations at all until
something builds them.

Expect `mockup-sandbox` to fail this. It is a design sandbox, not shipped, and
carries a pre-existing duplicate-React-types error. Everything else must pass.

### Shipping app changes

**JavaScript-only change** (screens, styling, logic) — publish an OTA update, no
App Store review:

```bash
cd artifacts/fes-app && eas update --branch production --message "what changed"
```

**Anything native** (new native module, permissions, app icon, `app.json` config)
requires a full build and a review cycle:

```bash
cd artifacts/fes-app && eas build --profile production --platform ios
```

The dividing line matters: if you add a dependency with native code, an OTA
update will ship JavaScript that calls into a module the installed binary does
not have, and the app will crash on launch for everyone. When unsure, build.

### Running locally

```bash
pnpm --filter @workspace/api-server run dev
```

```bash
cd artifacts/fes-app && npx expo start
```

`artifacts/fes-app/.env` decides which API the app talks to. It is untracked and
local to each machine.

**`.env` beats the shell.** `EXPO_PUBLIC_DOMAIN=x npx expo start` is silently
ignored while that key exists in `.env`. Edit the file, then restart Metro — it
does not reload env changes. Confirm what loaded by watching startup:

```
env: export EXPO_PUBLIC_DOMAIN EXPO_PUBLIC_API_TOKEN
```

### Where environment variables come from

This trips everyone once. Three different sources depending on how the app runs:

| Running via | Source |
|---|---|
| Metro (`expo start`), including a dev client | `artifacts/fes-app/.env` |
| EAS build | `eas.json` `env` block + EAS environment variables |
| EAS Update | Baked in when the update was **published** |

`EXPO_PUBLIC_*` values are inlined into the bundle at bundle time. A dev client
is a native shell that downloads JS from Metro, so it gets whatever Metro
inlined — EAS environment variables never reach it. A dev client without
`EXPO_PUBLIC_API_TOKEN` in the local `.env` will 401 on push registration and
look like a backend problem.

### Rotating the API token

`API_AUTH_TOKEN` lives in **four** places and they must match:

1. Render → `fes-api` → Environment
2. GitHub → Settings → Secrets and variables → Actions
3. cron-job.org → the job's `Authorization` header
4. EAS → three environment variables (development, preview, production)

```bash
openssl rand -hex 32
```

```bash
cd artifacts/fes-app && npx eas env:create --scope project --environment production --name EXPO_PUBLIC_API_TOKEN --visibility sensitive --type string
```

Update all four, then rebuild the app — the token is compiled into the binary.
A mismatch makes the cron go red (visible) and push registration 401 (visible
in logs, thanks to the reporting added in `_layout.tsx`).

### Database changes

```bash
pnpm --filter @workspace/db run push
```

Point `DATABASE_URL` at Neon first. There are no migration files — Drizzle
pushes the schema directly. With three tables that is proportionate; if the
schema grows, move to generated migrations before it does.

---

## 3. Health checks

### Is it up?

```bash
curl -s -o /dev/null -w '%{http_code} in %{time_total}s\n' https://fes-api.onrender.com/api/healthz
```

A slow first response (30–60s) means Render was asleep, not broken. The app
tolerates this — four retries across ~30 seconds.

### Is the scheduler actually working?

The endpoint returns per-job status, and **returns 500 if either job failed**:

```bash
curl -s -X POST https://fes-api.onrender.com/api/tasks/run -H "Authorization: Bearer $API_AUTH_TOKEN"
```

Healthy: `{"events":"ok","news":"ok","durationMs":...}`

Each job reports `ok`, `failed`, or `skipped`. Never change this back to a
uniform 200 — the whole point is that a broken schedule shows up as a red
workflow and an email rather than a green checkmark over nothing.

### Is push working?

The only real proof is a delivered notification. Full chain:

```sql
select id, platform, created_at from push_tokens order by created_at desc;
```

Then send a test through Expo with a registered token, and check the receipt —
a ticket says Expo accepted it, a **receipt** says Apple delivered it:

- `POST https://exp.host/--/api/v2/push/send` → returns a ticket id
- `POST https://exp.host/--/api/v2/push/getReceipts` with that id → `status: ok`

### Monitoring you do not have

There is **no uptime monitoring and no alerting**. If Render dies at 2am, you
find out when someone mentions the app is broken. The cheapest fix is a free
UptimeRobot check on `/api/healthz` with email alerts. Sentry is wired up but
inert until `SENTRY_DSN` is set — if you set it, revisit the App Store privacy
declaration, because crash data is a declarable category.

---

## 4. The failure mode this codebase keeps producing

**Silent failure.** Six separate instances have been found and fixed. They share
a shape: something goes wrong, nothing throws, everything looks healthy, and the
only symptom is an absence — a notification that never arrives, a reminder
nobody gets, an email that bounces to someone else.

Fixed so far:

| Where | What it looked like |
|---|---|
| `runSchedulerOnce` | Reported "ran" when both jobs threw |
| `processOnce` | Swallowed a calendar fetch failure, returned normally |
| `processNewsPushOnce` | Same, for WordPress |
| `_layout.tsx` | Discarded push registration's error return |
| `settings.tsx` | Toggle read "on" while nothing was registered |
| `push-delivery.ts` | Deleted the wrong token after a failed chunk |

Plus a reminder window narrower than the scheduler's real gap, and a contact
link mailing a dead address — both invisible from the inside.

**When you review a change here, ask: if this fails, how would anyone find out?**
If the answer is "someone eventually notices something missing," that is a bug,
even when the code is otherwise correct. Prefer:

- Return a status a caller must handle, over swallowing
- Fail closed and loudly in production, over falling open quietly
- A 5xx a monitor can see, over a 200 that means nothing
- Logging the specific reason, over a generic catch

Deliberate silent-catches that should **stay**, and why:

| Location | Why it is right |
|---|---|
| `pruneLedger` | Housekeeping; a failed prune must not fail the run |
| Ledger insert race | The unique index is what makes it safe |
| `formatTimeSuffix` | Cosmetic fallback |
| `unregisterPushNotifications` | Local flag still stops re-registration |

---

## 5. Scrapers: the fragile part

`investigators`, `equipment`, and `supporting-resources` parse HTML from
`fescenter.org`. They are written defensively — no positional assumptions, no
brittle CSS paths — but a site redesign will still break them.

**What breaks and how you will know:** a section silently goes empty. The API
returns `200` with `[]`. The app shows an empty state. Nothing errors.

The parsers have tests using captured HTML fixtures. **When the site changes,
update the fixture first, watch the test fail, then fix the parser.** A parser
fixed without a failing test is a parser you cannot trust.

`events.ts` is the exception and the biggest liability: **542 lines, roughly
twenty pure parsing functions, and no tests at all.** It handles iCal unfolding,
HTML entity decoding, URL canonicalisation, action-link classification, and
recurrence — and it feeds both the events screen and the reminder scheduler. It
is the highest-value place to add coverage; the functions are pure and take
strings, so tests are cheap.

Known upstream breakage, not ours to fix: all 37 equipment images 404 on
`fescenter.org`. The app degrades to placeholders deliberately.

---

## 6. Scheduling and reminders

An external cron drives the jobs because free hosts suspend idle services, and a
suspended process fires no timers.

**GitHub Actions is the backup, not the primary.** Measured 2026-08-07: one run
per hour against a 10-minute schedule, five consecutive ticks dropped.
cron-job.org is the primary. Both can run together — the jobs are idempotent.

Because the trigger is unreliable, `hour_before` reminders fire anywhere from 75
minutes out to the event start, with the title computed from the real time
remaining. A skipped tick delays a reminder instead of losing it.

**This only works because the `sent_notifications` unique index — not the window
— guarantees once-per-occurrence.** If you ever weaken that index, the window
becomes unsafe and reminders will duplicate. All-day events are excluded from
short-notice reminders; they sit at local midnight and would announce "Starting
now" as the date rolls over.

If you narrow these windows, narrow them to the worst gap you are willing to
tolerate from your trigger, not to its nominal interval.

---

## 7. Known issues and technical debt

Ordered by what I would fix first.

**1. `events.ts` has no tests.** Biggest single risk. 542 lines of parsing
feeding both events and reminders. Start with the pure string functions.

**2. No uptime monitoring or alerting.** You learn about outages from users.

**3. `weather.ts` and `news.ts` untested.** 228 and 271 lines.

**4. Dependency advisories.** `pnpm audit` reports alarming totals, but almost
all are build tooling (`@expo/cli`, `react-native`, `vitest`, `vite`) or
`mockup-sandbox`, which is not shipped. What actually runs in production:
`expo-server-sdk` 6.1.0 pulls a vulnerable `undici`; **7.1.0 is available** and
is the one upgrade worth doing — it is a major bump, so check
`sendPushNotificationsAsync`, `chunkPushNotifications`, and `isExpoPushToken`
still behave, and `push-delivery.test.ts` covers all three. `express` is already
at latest.

**5. Disk cache is pointless on Render.** `events.ts` caches to `os.tmpdir()`,
which is wiped on every deploy and every wake from sleep. Harmless, but do not
rely on it; the in-memory cache is what actually serves.

**6. Stale config.** `app.json` still has
`"expo-router": { "origin": "https://replit.com/" }` from the original template.
Only affects server-rendered routes, which this app does not use.

**7. Peer dependency mismatch.** `@tanstack/react-query-persist-client@5.101.4`
wants `@tanstack/react-query@^5.101.4`; the catalog pins `5.90.21`. Works today.

**8. No accessibility labels** on `investigators/[slug]` and `news/[id]`.

**9. `mockup-sandbox` fails typecheck.** Pre-existing, unshipped. Do not include
it in CI; consider deleting it once the design is settled.

---

## 8. Things that will bite you

**There is no CI.** Nothing runs tests on a pull request. Merging to `main`
deploys straight to production. Adding a GitHub Actions workflow that runs
`test`, `typecheck`, and `build` on PRs is an hour of work and the highest-value
process improvement available.

**`main` is production.** No staging.

**The App Store privacy declaration must match the generated privacy manifest.**
Expo generates that manifest from **installed** native modules, not imported
ones. An unused permission-gated dependency will make your build declare data
collection your questionnaire denies — a routine rejection. Four unused modules
were removed for exactly this reason. Before any submission:

```bash
cd artifacts/fes-app && npx expo config --type introspect | grep -iE "NS[A-Za-z]*UsageDescription"
```

Only calendar entries should appear. Anything else means a dependency crept
back in.

**The local `ios/` directory is gitignored and goes stale.** EAS prebuilds fresh
so it is unaffected, but run `expo prebuild --clean -p ios` before any local
Xcode build.

**Never import `drizzle-orm` directly in `api-server`.** Import operators from
`@workspace/db`, which re-exports them. pnpm keys a package's directory on its
resolved peers; drizzle-orm's peers include `pg`, which `lib/db` has and
`api-server` does not. Import it in both and you can get two physically
different copies, at which point a column from one is not assignable to an
operator from the other and the build fails with an opaque message about
"separate declarations of a private property `shouldInlineParams`". This
happened on 2026-08-10 after an unrelated `pnpm remove` re-resolved the
lockfile — nothing about the change had anything to do with the database.

**Free tiers change.** Render, Neon, and cron-job.org are all free today with no
card. Watch for policy changes; the architecture assumes nothing paid.

**`API_AUTH_TOKEN` ships inside the IPA.** Anyone who unpacks the binary can
read it. It removes drive-by abuse, not determined abuse. Real per-user auth
needs an identity system the app does not have. Do not mistake it for more than
it is.

---

## 9. Release checklist

For a new App Store version:

1. Merge everything to `main`; confirm Render deployed
2. `pnpm --filter @workspace/api-server run test` — all green
3. Both typechecks pass (`api-server`, `fes-app`)
4. `expo config --type introspect` shows only calendar permission strings
5. Bump `version` in `app.json` if user-visible
6. `eas build --profile production --platform ios`
7. `eas submit --profile production --platform ios`
8. In App Store Connect: privacy answers still **Device ID / not tracking / not
   linked / App Functionality**, and the privacy policy URL still resolves
9. Submit for review

At review time, watch for Guideline 4.2/4.3 — Apple sometimes pushes
single-organisation apps toward Apple Business Manager custom apps. This app
should be fine because all content is public information from `fescenter.org`,
but **do not describe it as "for FES Center staff"** in the listing.

---

## 10. Key facts

| | |
|---|---|
| Bundle ID | `org.fescenter.app` |
| App Store Connect ID | `6799172719` |
| Apple Team | `P39U3HV6UJ` (Fes Institute) |
| EAS project | `706ee23d-9f64-46e3-80b6-bb112cbfb6d2`, owner `ameen01` |
| API | `https://fes-api.onrender.com` |
| Privacy policy | `https://fescenter.org/privacy-policy-2/` |
| Calendar feed | public Google Calendar iCal, hardcoded in `events.ts` |
| Content contact | Cheryl Dudek, `cdudek@fescenter.org` |
| Website / comms | Mary Buckett, `mbuckett@FEScenter.org` |
