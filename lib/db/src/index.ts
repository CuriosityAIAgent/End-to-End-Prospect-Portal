import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Lazy connection: the server boots WITHOUT a database (so the app/static site
// can deploy before Postgres is provisioned). The pool connects on first query;
// DB-backed endpoints fail per-request until DATABASE_URL is set, instead of
// crashing the whole process at import time.
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
