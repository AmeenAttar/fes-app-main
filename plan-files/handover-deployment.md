# Deployment — the free-forever stack

Nothing here has a trial clock or needs a card. The constraint that shaped it:
**every free web tier suspends an idle service**, and this app has background
jobs.

| Piece | Service | Why |
|---|---|---|
| API server | Render, free web service | No monthly limit; suspends when idle, which we work around below |
| Postgres | Neon, free tier | Permanent. Render's own free Postgres **expires after 30 days** — do not use it |
| Scheduler | GitHub Actions cron | Free on public repos; owns the cadence *and* keeps Render awake |
| Push delivery | Expo Push Service | Free |
| Error reporting | Sentry free tier | Optional — omit `SENTRY_DSN` and it no-ops |

---

## The problem this solves

The API server used to run its own `setInterval` timers for event reminders and
news pushes. A suspended process runs no timers. On a free host the reminders
would simply stop, with no error and nothing in the logs — the same silent
failure mode that hid the retired `/test` URLs and the cookie banner in every
investigator bio.

So the schedule moved outside the process:

- `runSchedulerOnce()` in `lib/notifications.ts` runs one pass of both jobs.
- `POST /api/tasks/run` triggers it, guarded by `API_AUTH_TOKEN`.
- `.github/workflows/scheduler.yml` calls it every 10 minutes.
- `INTERNAL_SCHEDULER=off` turns off the now-redundant in-process timers.

Reminders become accurate to ±10 minutes instead of ±5. The existing reminder
windows are 18–30 hours and 50–75 minutes wide, so this changes nothing that a
user could notice.

**The endpoint fails closed.** Unlike the other guarded routes, which fall open
when `API_AUTH_TOKEN` is unset so local dev keeps working, `/api/tasks/run`
returns `503 scheduler_not_configured` without a token. It sends real
notifications; an anonymous trigger is not something to shrug at. Local
development uses the in-process timer and needs no token.

---

## Order of operations

**1. Database — Neon**

Create a project, copy the pooled connection string, then push the schema:

```bash
DATABASE_URL='postgresql://...' pnpm --filter @workspace/db run push
```

**2. API server — Render**

Point Render at this repo; `render.yaml` is picked up automatically. Set the
three `sync: false` secrets in the dashboard:

| Variable | Value |
|---|---|
| `DATABASE_URL` | The Neon connection string |
| `API_AUTH_TOKEN` | A fresh random secret — `openssl rand -hex 32` |
| `SENTRY_DSN` | From Sentry, or leave unset |

Confirm `https://<your-service>.onrender.com/api/healthz` returns `200`.

**3. Scheduler — GitHub Actions**

Add two repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `API_BASE_URL` | `https://<your-service>.onrender.com` — no trailing slash |
| `API_AUTH_TOKEN` | **The same value you gave Render** |

Then run the workflow once by hand (Actions → Notification scheduler → Run
workflow) rather than waiting 10 minutes to find out whether it works. A
successful run prints `{"events":"ok","news":"ok","durationMs":...}`.

Each job reports `ok`, `failed`, or `skipped` (skipped meaning a previous run of
that job was still going). If either says `failed` the endpoint returns **500**,
so the workflow goes red and GitHub emails you. That is deliberate: the jobs
catch their own errors so one cannot abort the other, and without the 500 a run
where both threw would look exactly like a healthy one.

**4. Mobile app**

`EXPO_PUBLIC_DOMAIN` is already `fes-api.onrender.com` in all three build
profiles. It is a hostname, not a secret, so it lives in `eas.json`.

**`EXPO_PUBLIC_API_TOKEN` deliberately does not.** This repo is public and
`eas.json` is tracked, so a token committed there is a token published — secret
scanners find those within hours. It is worse than the risk already accepted in
`lib/security.ts` ("the secret ships inside the IPA"): extractable by someone
who unpacks a binary is not the same as sitting in a public repo.

It is stored as an EAS environment variable instead, which is why each profile
carries an `"environment"` key — that is what tells the build which set to pull
in. Create it once per environment:

```bash
cd artifacts/fes-app
npx eas env:create --scope project --environment development \
  --name EXPO_PUBLIC_API_TOKEN --visibility sensitive
```

Repeat with `--environment preview` and `--environment production`, using the
same value each time — the one Render and the GitHub secret already hold.

`sensitive` rather than `secret`: an `EXPO_PUBLIC_` variable is inlined into the
JS bundle at build time regardless, so claiming it is write-only would be a lie.
Sensitive hides it from logs and the dashboard, which is the honest ceiling.

The `"environment"` key needs a recent `eas-cli`. An older one errors clearly on
an unknown field rather than silently ignoring it.

---

## Things that will bite you

**The first request after idling takes 30–60 seconds.** Render has to wake the
service. The workflow retries three times with a 30-second gap for exactly this
reason. Users rarely hit it, because the 10-minute cron keeps the service warm.

**GitHub's scheduler is the backup, not the primary.** It was the primary for
about two hours on 2026-08-07 and measured this badly:

```
16:08:04Z  success  first
17:07:16Z  success  59 min later    ← five consecutive ticks dropped
```

One run an hour against a 10-minute schedule. Two consequences: reminders came
within a whisker of being lost (the 0–75 minute window has no margin against
59-minute gaps), and Render slept through roughly 45 minutes of every hour, so
users hit 30–60 second cold starts on open.

Its cron was moved off round minutes (`7,17,27…` rather than `*/10`) because
GitHub sheds scheduled load hardest at the top of the hour and on round
intervals. That improves the odds; it does not make it dependable.

Both triggers can run together safely — event reminders dedupe on the
`sent_notifications` unique index and news push advances a stored cursor, so a
doubled run repeats work rather than notifying anyone twice.

The reminder windows are still sized to tolerate gaps: `hour_before` covers
0–75 minutes out rather than a narrow band. See Decision 5 in
`handover-decisions.md` before changing them.

---

## Primary trigger — cron-job.org

Free, no card, no expiry, 1-minute resolution. It calls the same endpoint, so
there is no code involved — only configuration.

1. Sign up at https://console.cron-job.org
2. **Create cronjob**, then fill in:

   | Field | Value |
   |---|---|
   | Title | `FES scheduler` |
   | URL | `https://fes-api.onrender.com/api/tasks/run` |
   | Schedule | Every 10 minutes |
   | Request method | **POST** (under Advanced) |

3. Under **Advanced → Headers**, add:

   ```
   Authorization: Bearer <the same API_AUTH_TOKEN>
   ```

4. Enable **notifications on failure** so a broken schedule emails you rather
   than going quiet — the whole point of moving off GitHub.
5. Save, then use **Test run** and confirm `200` with
   `{"events":"ok","news":"ok",...}`.

Leave the GitHub workflow enabled. It costs nothing, and on the days
cron-job.org has an outage it is the difference between degraded and dead.

**What this costs you:** `API_AUTH_TOKEN` is now held by a third party. It is a
shared secret already destined to ship inside the IPA, so the marginal exposure
is small — but it is a credential handed to another service, and rotating it
now means updating four places rather than three (Render, GitHub, cron-job.org,
EAS).

**Scheduled workflows are disabled after 60 days of no repo activity.** GitHub
emails first. Any commit re-arms it.

**Rotating `API_AUTH_TOKEN` means updating three places** — Render, the GitHub
secret, and `eas.json` (which needs an app rebuild). Change them together or
push notifications stop.
