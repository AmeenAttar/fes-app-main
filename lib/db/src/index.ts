import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";

/**
 * Query operators are re-exported so callers never import `drizzle-orm`
 * directly.
 *
 * pnpm keys a package's directory on its resolved peers, and drizzle-orm's
 * peers include `pg`. This package has `pg`; the API server does not, so each
 * can resolve a *different* physical copy of drizzle-orm — at which point a
 * column from this package's schema is not assignable to an operator from the
 * server's copy, and the build fails with an opaque "separate declarations of
 * a private property 'shouldInlineParams'". It happened here on 2026-08-10
 * after an unrelated `pnpm remove` re-resolved the lockfile.
 *
 * Importing operators from this package instead makes a single instance
 * structural rather than a coincidence of resolution order.
 */
export { and, asc, desc, eq, gte, inArray, lt, lte, or, sql } from "drizzle-orm";
