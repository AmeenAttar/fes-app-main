import { Router, type IRouter } from "express";

import { runSchedulerOnce } from "../lib/notifications";
import { isApiTokenConfigured, requireApiToken } from "../lib/security";

export const tasksRouter: IRouter = Router();

/**
 * Runs one pass of the notification jobs.
 *
 * This exists so the schedule can live outside the process. Free hosting tiers
 * suspend a service after a few idle minutes, and a suspended process runs no
 * timers — event reminders and news pushes would just stop, silently. An
 * external cron calling this both owns the cadence and keeps the service awake.
 *
 * Unlike the other guarded routes, this one refuses to run when `API_AUTH_TOKEN`
 * is unset rather than falling open: it does real work and sends real
 * notifications, so an unauthenticated trigger is not something to shrug at.
 * Local development uses the in-process timer, which needs no token.
 */
tasksRouter.post("/tasks/run", (req, res, next) => {
  if (!isApiTokenConfigured()) {
    res.status(503).json({
      error: "scheduler_not_configured",
      message:
        "Set API_AUTH_TOKEN to enable externally triggered scheduler runs.",
    });
    return;
  }
  requireApiToken(req, res, next);
});

tasksRouter.post("/tasks/run", (req, res, next) => {
  const startedAt = Date.now();
  runSchedulerOnce()
    .then((result) => {
      req.log?.info({ ...result }, "Scheduler run triggered over HTTP");
      res.json({ ...result, durationMs: Date.now() - startedAt });
    })
    .catch(next);
});

export default tasksRouter;
