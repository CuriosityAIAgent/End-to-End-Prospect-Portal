import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL; rejectUnauthorized:false accepts their self-signed cert.
  ssl: { rejectUnauthorized: false },
  // Serverless: cap at 1 so each cold-start doesn't exhaust Supabase's
  // connection limit (Vercel spins up a fresh pool per function invocation).
  max: 1,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
