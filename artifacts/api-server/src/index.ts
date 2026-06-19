import app from "./app";
import { logger } from "./lib/logger";
import { recoverStaleJobs } from "./jobs/runner";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Any job left mid-run by a previous process is orphaned — fail it so the UI
  // stops polling and offers a retry, rather than spinning forever.
  void recoverStaleJobs();
});
