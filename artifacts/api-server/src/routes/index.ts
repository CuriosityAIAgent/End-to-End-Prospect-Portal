import { Router, type IRouter } from "express";
import healthRouter from "./health";
import assessmentsRouter from "./assessments";
import prospectsRouter from "./prospects";

const router: IRouter = Router();

router.use(healthRouter);
router.use(assessmentsRouter);
router.use(prospectsRouter);

export default router;
