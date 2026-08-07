// Initialised before the app is imported so early failures are still captured.
import { flushMonitoring, initMonitoring } from "./lib/monitoring";

initMonitoring();

import app from "./app";
import { logger } from "./lib/logger";
import {
  startNotificationScheduler,
  stopNotificationScheduler,
} from "./lib/notifications";
import { logSecurityConfig } from "./lib/security";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  logSecurityConfig();
  startNotificationScheduler();
});

/**
 * Without this, a deploy drops in-flight requests and the scheduler's timers
 * keep firing while the process is being torn down.
 */
let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");

  stopNotificationScheduler();
  server.close(() => {
    void flushMonitoring().then(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  });

  // Don't hang forever on a stuck connection.
  setTimeout(() => {
    logger.warn("Forcing exit after shutdown timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
