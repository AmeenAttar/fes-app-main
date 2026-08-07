import { afterEach, describe, expect, it, vi } from "vitest";

import type { NextFunction, Request, Response } from "express";

/**
 * `API_AUTH_TOKEN` is read once at module load, so each case needs a fresh
 * module registry rather than just a reassigned `process.env`.
 */
async function loadSecurity(token: string | undefined) {
  vi.resetModules();
  if (token === undefined) {
    delete process.env["API_AUTH_TOKEN"];
  } else {
    process.env["API_AUTH_TOKEN"] = token;
  }
  return import("./security");
}

function fakeExchange(authorization?: string) {
  const next = vi.fn() as unknown as NextFunction;
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  const req = {
    path: "/tasks/run",
    get: (name: string) =>
      name.toLowerCase() === "authorization" ? authorization : undefined,
    log: { warn: vi.fn() },
  };
  return {
    next,
    res,
    run: (mw: typeof import("./security").requireApiToken) =>
      mw(req as unknown as Request, res as unknown as Response, next),
  };
}

afterEach(() => {
  delete process.env["API_AUTH_TOKEN"];
});

describe("requireApiToken", () => {
  it("accepts a matching bearer token", async () => {
    const { requireApiToken } = await loadSecurity("s3cret");
    const x = fakeExchange("Bearer s3cret");
    x.run(requireApiToken);
    expect(x.next).toHaveBeenCalledOnce();
    expect(x.res.statusCode).toBe(0);
  });

  it("rejects a wrong or missing token with 401", async () => {
    const { requireApiToken } = await loadSecurity("s3cret");

    const wrong = fakeExchange("Bearer nope");
    wrong.run(requireApiToken);
    expect(wrong.next).not.toHaveBeenCalled();
    expect(wrong.res.statusCode).toBe(401);

    const absent = fakeExchange(undefined);
    absent.run(requireApiToken);
    expect(absent.next).not.toHaveBeenCalled();
    expect(absent.res.statusCode).toBe(401);
  });

  // Deliberate: local dev and the pre-existing deploy predate the token, and
  // the routes it guards degrade to the behaviour they already had.
  it("falls open when no token is configured", async () => {
    const { requireApiToken, isApiTokenConfigured } =
      await loadSecurity(undefined);
    expect(isApiTokenConfigured()).toBe(false);

    const x = fakeExchange(undefined);
    x.run(requireApiToken);
    expect(x.next).toHaveBeenCalledOnce();
  });

  // Whitespace-only would otherwise read as "configured" and lock everyone out.
  it("treats a blank token as unconfigured", async () => {
    const { isApiTokenConfigured } = await loadSecurity("   ");
    expect(isApiTokenConfigured()).toBe(false);
  });
});
