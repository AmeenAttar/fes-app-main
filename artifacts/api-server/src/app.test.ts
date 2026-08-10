import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Everything else in this suite tests helpers in isolation. Nothing drove a
 * real request through Express, so the parts that only exist at the HTTP layer
 * — status codes, the error envelope, auth middleware, body limits, the
 * security headers — were unverified.
 *
 * That layer is where a mistake is both easy to make and invisible: a guard
 * mounted on the wrong path, or an error handler that stops shaping responses,
 * looks fine in every unit test and leaks a stack trace in production.
 */

const insertedTokens: unknown[] = [];
const deletedTokens: string[] = [];

vi.mock("@workspace/db", () => ({
  db: {
    insert: () => ({
      values: (v: unknown) => ({
        onConflictDoUpdate: () => {
          insertedTokens.push(v);
          return Promise.resolve();
        },
      }),
    }),
    delete: () => ({
      where: (t: string) => {
        deletedTokens.push(t);
        return Promise.resolve();
      },
    }),
    select: () => ({ from: () => Promise.resolve([]) }),
  },
  pushTokensTable: { token: "token" },
  sentNotificationsTable: {},
  newsPushStateTable: {},
  NEWS_PUSH_STATE_KEY: "default",
  eq: (_c: unknown, v: unknown) => v,
  sql: (s: unknown) => s,
  inArray: () => ({}),
  lt: () => ({}),
}));

const runSchedulerOnce = vi.fn();
vi.mock("./lib/notifications", () => ({
  runSchedulerOnce: () => runSchedulerOnce(),
  startNotificationScheduler: vi.fn(),
  stopNotificationScheduler: vi.fn(),
}));

vi.mock("./lib/monitoring", () => ({
  captureError: vi.fn(),
  initMonitoring: vi.fn(),
  flushMonitoring: () => Promise.resolve(),
}));

/** Fresh module registry per case, because API_AUTH_TOKEN is read at load. */
async function loadApp(token: string | undefined) {
  vi.resetModules();
  if (token === undefined) delete process.env["API_AUTH_TOKEN"];
  else process.env["API_AUTH_TOKEN"] = token;
  const mod = await import("./app");
  return mod.default;
}

const TOKEN = "test-token-value";
const VALID_EXPO_TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

beforeEach(() => {
  insertedTokens.length = 0;
  deletedTokens.length = 0;
  runSchedulerOnce.mockReset().mockResolvedValue({ events: "ok", news: "ok" });
});

describe("health", () => {
  it("answers without auth", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
  });
});

describe("unknown routes", () => {
  // Express's default 404 is an HTML page; the app is a JSON API and the
  // client parses every response as JSON.
  it("returns a JSON envelope, not HTML", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app).get("/api/no-such-thing");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/json/u);
    expect(res.body).toEqual({
      error: "not_found",
      message: expect.any(String),
    });
  });

  it("404s outside /api too", async () => {
    const app = await loadApp(TOKEN);
    expect((await request(app).get("/")).status).toBe(404);
  });
});

describe("security middleware", () => {
  it("sets helmet's headers", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app).get("/api/healthz");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-dns-prefetch-control"]).toBeDefined();
  });

  it("advertises the rate limit", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app).get("/api/healthz");
    expect(res.headers["ratelimit-policy"]).toContain("120");
  });

  // Native apps send no Origin at all, so the allowlist must not reject them.
  it("allows a request with no Origin header", async () => {
    const app = await loadApp(TOKEN);
    expect((await request(app).get("/api/healthz")).status).toBe(200);
  });
});

describe("POST /api/push-tokens", () => {
  it("rejects a request with no token", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/push-tokens")
      .send({ token: VALID_EXPO_TOKEN, platform: "ios" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
    expect(insertedTokens).toEqual([]);
  });

  it("rejects a wrong token", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/push-tokens")
      .set("Authorization", "Bearer wrong")
      .send({ token: VALID_EXPO_TOKEN, platform: "ios" });
    expect(res.status).toBe(401);
  });

  it("accepts a valid registration", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/push-tokens")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ token: VALID_EXPO_TOKEN, platform: "ios" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(insertedTokens).toEqual([
      { token: VALID_EXPO_TOKEN, platform: "ios" },
    ]);
  });

  it("rejects a malformed body with 400, not 500", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/push-tokens")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ platform: "ios" });
    expect(res.status).toBe(400);
    expect(insertedTokens).toEqual([]);
  });

  it("rejects an unknown platform", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/push-tokens")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ token: VALID_EXPO_TOKEN, platform: "windows-phone" });
    expect(res.status).toBe(400);
  });

  // Storing a token Expo cannot deliver to would make every future send fail
  // for that row, forever.
  it("rejects a well-formed string that is not an Expo token", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/push-tokens")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ token: "just-a-string", platform: "ios" });
    expect(res.status).toBe(400);
    expect(insertedTokens).toEqual([]);
  });
});

describe("DELETE /api/push-tokens/:token", () => {
  it("requires auth", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app).delete(
      `/api/push-tokens/${encodeURIComponent(VALID_EXPO_TOKEN)}`,
    );
    expect(res.status).toBe(401);
    expect(deletedTokens).toEqual([]);
  });

  it("deletes the token it was given, url-decoded", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .delete(`/api/push-tokens/${encodeURIComponent(VALID_EXPO_TOKEN)}`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(deletedTokens).toEqual([VALID_EXPO_TOKEN]);
  });
});

describe("POST /api/tasks/run", () => {
  // This one fails closed rather than falling open, because it does real work
  // and sends real notifications.
  it("returns 503 when no token is configured at all", async () => {
    const app = await loadApp(undefined);
    const res = await request(app).post("/api/tasks/run");
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("scheduler_not_configured");
    expect(runSchedulerOnce).not.toHaveBeenCalled();
  });

  it("returns 401 when a token is configured and not supplied", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app).post("/api/tasks/run");
    expect(res.status).toBe(401);
    expect(runSchedulerOnce).not.toHaveBeenCalled();
  });

  it("runs and reports per-job status", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/tasks/run")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ events: "ok", news: "ok" });
    expect(res.body.durationMs).toEqual(expect.any(Number));
  });

  // The reason this endpoint exists in this shape: a green cron over a broken
  // schedule is the failure this whole project keeps producing.
  it("returns 500 when a job failed, so the cron goes red", async () => {
    runSchedulerOnce.mockResolvedValue({ events: "failed", news: "ok" });
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/tasks/run")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: "job_failed", events: "failed" });
  });

  it("still 500s when only the news job failed", async () => {
    runSchedulerOnce.mockResolvedValue({ events: "ok", news: "failed" });
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/tasks/run")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(500);
  });

  // A skipped job means a previous run is still going, which is normal.
  it("treats skipped as success", async () => {
    runSchedulerOnce.mockResolvedValue({ events: "skipped", news: "ok" });
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/tasks/run")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
  });
});

describe("error handling", () => {
  // Without the terminal handler, Express replies with an HTML stack trace
  // containing absolute file paths.
  it("shapes an unhandled route error as JSON with no stack", async () => {
    runSchedulerOnce.mockRejectedValue(new Error("boom with /secret/path"));
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/tasks/run")
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(res.status).toBe(500);
    expect(res.headers["content-type"]).toMatch(/json/u);
    expect(res.body).toEqual({
      error: "internal_error",
      message: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toContain("/secret/path");
  });

  it("rejects a body over the size limit", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/push-tokens")
      .set("Authorization", `Bearer ${TOKEN}`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ token: "x".repeat(100_000), platform: "ios" }));
    expect(res.status).toBe(413);
  });

  // 400, not 500: the client sent something invalid. A 500 would blame the
  // server, trip the uptime alarm, and generate a Sentry event for someone
  // else's bad request.
  it("rejects malformed JSON as a client error, without leaking a parser stack", async () => {
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/push-tokens")
      .set("Authorization", `Bearer ${TOKEN}`)
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/json/u);
    expect(res.body.error).toBeDefined();
    expect(JSON.stringify(res.body)).not.toMatch(/at \/|node_modules/u);
  });

  // An error carrying a 5xx really is ours, and must not be reframed as the
  // caller's fault by the 4xx passthrough above.
  it("still reports a genuine server error as 500", async () => {
    runSchedulerOnce.mockRejectedValue(
      Object.assign(new Error("upstream exploded"), { status: 502 }),
    );
    const app = await loadApp(TOKEN);
    const res = await request(app)
      .post("/api/tasks/run")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("internal_error");
  });
});
