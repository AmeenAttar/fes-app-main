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
successful run prints `{"events":"ran","news":"ran","durationMs":...}`.

**4. Mobile app**

Set `EXPO_PUBLIC_DOMAIN` to the Render host and `EXPO_PUBLIC_API_TOKEN` to the
same token, in **all three** `eas.json` build profiles.

---

## Things that will bite you

**The first request after idling takes 30–60 seconds.** Render has to wake the
service. The workflow retries three times with a 30-second gap for exactly this
reason. Users rarely hit it, because the 10-minute cron keeps the service warm.

**GitHub delays scheduled workflows under load**, sometimes past 10 minutes, and
occasionally skips a tick. Both jobs are idempotent — event reminders dedupe on
the `sent_notifications` unique index, news push advances a stored cursor — so a
late, doubled, or skipped run never notifies anyone twice.

**Scheduled workflows are disabled after 60 days of no repo activity.** GitHub
emails first. Any commit re-arms it.

**Rotating `API_AUTH_TOKEN` means updating three places** — Render, the GitHub
secret, and `eas.json` (which needs an app rebuild). Change them together or
push notifications stop.
