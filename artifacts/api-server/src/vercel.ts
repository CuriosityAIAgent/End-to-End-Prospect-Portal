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

app.use("/api", router);

export default app;
