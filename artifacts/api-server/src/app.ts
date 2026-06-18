import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
// Raised from the 100kb default so base64-encoded voice-note clips fit; the
// transcription route caps the decoded audio at 25 MB.
app.use(express.json({ limit: "34mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve the built frontend (single-service deploy). Set WEB_DIST to override;
// defaults to the sow-tool build relative to the process working directory.
// When the build isn't present (pure-API runs), these are simply no-ops.
const webDist = process.env.WEB_DIST
  ? path.resolve(process.env.WEB_DIST)
  : path.resolve(process.cwd(), "artifacts/sow-tool/dist/public");

app.use(express.static(webDist));

// SPA fallback: any non-API GET serves index.html so client-side routes work.
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api")) {
    next();
    return;
  }
  res.sendFile(path.join(webDist, "index.html"), (err) => {
    if (err) next();
  });
});

export default app;
