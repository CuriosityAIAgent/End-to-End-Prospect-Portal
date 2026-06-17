// Serverless entry point for Vercel.
//
// Vercel's Node runtime invokes the default export as `(req, res)`. Express is
// itself such a function, so we export the app directly instead of calling
// app.listen(). The storage routes are omitted — they depend on the Replit GCS
// sidecar (objectStorage.ts) which is not available outside Replit.
import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger";
import healthRouter from "./routes/health";
import assessmentsRouter from "./routes/assessments";
import prospectsRouter from "./routes/prospects";
import fileNotesRouter from "./routes/fileNotes";
import sourceOfWealthRouter from "./routes/sourceOfWealth";
import transcriptionRouter from "./routes/transcription";

const app = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "34mb" }));
app.use(express.urlencoded({ extended: true }));

const router = express.Router();
router.use(healthRouter);
router.use(assessmentsRouter);
router.use(prospectsRouter);
router.use(fileNotesRouter);
router.use(sourceOfWealthRouter);
router.use(transcriptionRouter);

// Temporary debug endpoint — reports the DB host the function is using and
// whether the prospects table exists. Remove once Vercel↔Neon plumbing is
// verified. Path is intentionally awkward to avoid collisions.
app.get("/api/_debug/db", async (_req, res) => {
  try {
    const { pool } = await import("@workspace/db");
    const url = process.env.DATABASE_URL ?? "";
    const host = url.match(/@([^/?:]+)/)?.[1] ?? "(no match)";
    const dbName = url.match(/\/([^/?]+)(\?|$)/)?.[1] ?? "(no match)";
    const tables = await pool.query(
      "select table_name from information_schema.tables where table_schema='public' order by table_name",
    );
    res.json({
      ok: true,
      dbHost: host,
      dbName,
      hasDatabaseUrl: url.length > 0,
      urlLength: url.length,
      tables: tables.rows.map((r: { table_name: string }) => r.table_name),
    });
  } catch (err) {
    const e = err as { message?: string; code?: unknown };
    res.status(500).json({ ok: false, error: e.message, code: e.code });
  }
});

// Temporary one-shot migration endpoint — creates the tables on the exact
// Neon DB the function is connected to. Idempotent (IF NOT EXISTS). Remove
// once Vercel↔Neon plumbing is verified end-to-end.
const migrateHandler = async (_req: express.Request, res: express.Response) => {
  try {
    const { pool } = await import("@workspace/db");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prospects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        segment TEXT,
        relationship_manager TEXT,
        status TEXT NOT NULL DEFAULT 'identified',
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        briefing JSONB,
        converted_assessment_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS assessments (
        id SERIAL PRIMARY KEY,
        client_name TEXT NOT NULL,
        client_reference TEXT,
        relationship_manager TEXT,
        review_type TEXT,
        risk_rating TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    const tables = await pool.query(
      "select table_name from information_schema.tables where table_schema='public' order by table_name",
    );
    res.json({ ok: true, tables: tables.rows.map((r: { table_name: string }) => r.table_name) });
  } catch (err) {
    const e = err as { message?: string; code?: unknown };
    res.status(500).json({ ok: false, error: e.message, code: e.code });
  }
};
app.get("/api/_debug/migrate", migrateHandler);
app.post("/api/_debug/migrate", migrateHandler);

app.use("/api", router);

// Unhandled-route-error handler. Logs the FULL error chain (including .cause,
// which Drizzle uses to wrap the underlying pg error) so we can see real DB
// failures in the Vercel logs instead of a generic "Failed query: ...".
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const chain: Array<{ message: string; code?: unknown; stack?: string }> = [];
  let current: unknown = err;
  while (current) {
    const e = current as { message?: string; code?: unknown; cause?: unknown; stack?: string };
    chain.push({ message: e.message ?? String(current), code: e.code, stack: e.stack });
    current = e.cause;
  }
  req.log.error({ errChain: chain }, "Unhandled route error");
  if (!res.headersSent) {
    res.status(500).json({ error: chain[chain.length - 1]?.message ?? "Internal Server Error" });
  }
});

export default app;
