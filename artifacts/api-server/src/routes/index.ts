import { Router, type IRouter } from "express";
import healthRouter from "./health";
import assessmentsRouter from "./assessments";
import prospectsRouter from "./prospects";
import fileNotesRouter from "./fileNotes";
import sourceOfWealthRouter from "./sourceOfWealth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(assessmentsRouter);
router.use(prospectsRouter);
router.use(fileNotesRouter);
router.use(sourceOfWealthRouter);

export default router;
