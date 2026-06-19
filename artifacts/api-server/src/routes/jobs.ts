import { Router, type IRouter } from "express";
import { getJob, serializeJob } from "../jobs/runner";

const router: IRouter = Router();

// Poll target for background jobs (prep packs, briefings). Returns staged
// status, progress, an optional partial result, and the final result.
router.get("/jobs/:id", async (req, res): Promise<void> => {
  const job = await getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(serializeJob(job));
});

export default router;
