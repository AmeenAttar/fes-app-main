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

### Automated monitoring

`.github/workflows/uptime.yml` probes the API every 30 minutes and fails the
workflow when something is wrong. GitHub emails the repository owner on a failed
scheduled run, so a red run *is* the alert — no third-party monitoring account
needed.

It is deliberately separate from the scheduler workflow. That one only exercises
`/api/tasks/run`; this one checks the read paths the app actually uses, and
checks the database via the one endpoint that touches Postgres on every call.

It also fails on a **200 with a suspiciously small body**, which is how a broken
scraper presents: the endpoint is fine, the parser returned nothing, and the app
shows a blank screen with no error anywhere.

Two caveats. GitHub's scheduler drops ticks (see §6), so treat a missing run as
uninformative rather than reassuring. And it cannot alert on something it does
not probe — add a check when you add an endpoint that matters.

Sentry is wired up but inert until `SENTRY_DSN` is set. If you set it, revisit
the App Store privacy declaration: crash data is a declarable category.

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

`news.ts` deserves extra care: `toNewsItem` decides what the list shows *and*
what a push notification says, so a regression there reaches lock screens, not
just a screen someone chose to open.

`stripDangerousMarkup` in `lib/html.ts` is the last point at which executable
markup leaves the server, because the article body renders in a WebView with
JavaScript enabled and nothing on the client sanitises it. It is a hedge, not a
sanitiser — regexes cannot parse HTML. Do not extend the app to render HTML from
anywhere other than the Center's own WordPress without replacing it properly.

`events.ts` was the exception — 542 lines with no coverage — and now has 63
tests over its eleven pure helpers, which are exported for that purpose and not
for callers. Writing them surfaced three real bugs that had been shipping:

| Bug | Effect |
|---|---|
| `\s+\n` collapsed newlines before the `\n{3,}` rule could run | Paragraph breaks stripped from every description; the rule below it was dead code |
| `)` stripped before `,` in `trimUrlTail` | A URL written `(see https://x/a),` kept its closing paren |
| `Date.parse("-5")` reads as the year 2001 | A malformed `Retry-After` produced a 0 ms cooldown — no back-off at all, right after a 429 asked us to slow down |

None of them changed output for the current feed: running the fixed parser
against the live calendar and diffing all 24 events against production gave zero
differences. They are latent, which is exactly why they survived.

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

**1. Four unpatched advisories inside `express`.** `path-to-regexp`, `qs`, and
`body-parser`, reachable via `express` 5.2.1 — already the latest published, so
there is no upgrade to take. The `path-to-regexp` DoS needs sequential optional
groups in a route pattern and none of ours have any. Recheck when Express
releases.

**2. The undici override is a pin to watch.** `package.json` has
`pnpm.overrides["undici@^7.0.0"] = ">=7.29.0 <8.0.0"`, because
`expo-server-sdk@7.1.0` allows `^7.2.0` and pnpm otherwise settles on 7.25.0,
which is vulnerable. Drop the override once expo-server-sdk raises its own
floor — and keep the upper bound: unbounded, pnpm jumps to undici 8, which
expo-server-sdk does not support.

**3. Disk cache is pointless on Render.** `events.ts` caches to `os.tmpdir()`,
which is wiped on every deploy and every wake from sleep. Harmless, but do not
rely on it; the in-memory cache is what actually serves.

**4. Route coverage is helper-level, not HTTP-level.** Every route's parsing
helpers are tested, but no test drives an actual Express request through
`app.ts` — so status codes, query validation, caching behaviour and the error
envelope are unverified. Supertest against `app` would close this.

**5. `mockup-sandbox` fails typecheck.** Pre-existing, unshipped, excluded from
CI. Consider deleting it once the design is settled.

**6. `esbuild-plugin-pino` pins a stale esbuild range.** It wants
`>=0.25.0 <=0.25.8`; the workspace has 0.27.3. The build works — this is a peer
warning, not a failure.

---

## 8. Things that will bite you

**`main` is production.** No staging. Render redeploys on every push to `main`,
so `.github/workflows/ci.yml` is the only gate in front of a live API. It runs
typecheck, tests, and build on every pull request and every push to `main`.

`mockup-sandbox` is deliberately excluded from CI. It is unshipped and carries a
pre-existing duplicate-React-types failure; including it would make CI
permanently red, and a permanently red CI is one nobody reads.

The audit job is `continue-on-error` for the same reason — almost every advisory
lives in build tooling, so failing on them would train people to ignore the X.

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
