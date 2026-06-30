import { Router, type IRouter } from "express";
import healthRouter from "./health";
import assessmentsRouter from "./assessments";
import prospectsRouter from "./prospects";
import jobsRouter from "./jobs";
import fileNotesRouter from "./fileNotes";
import sourceOfWealthRouter from "./sourceOfWealth";
import transcriptionRouter from "./transcription";
import storageRouter from "./storage";
import fcaRouter from "./fca";
import corroborationRouter from "./corroboration";

const router: IRouter = Router();

router.use(healthRouter);
router.use(assessmentsRouter);
router.use(prospectsRouter);
router.use(jobsRouter);
router.use(fileNotesRouter);
router.use(sourceOfWealthRouter);
router.use(transcriptionRouter);
router.use(storageRouter);
router.use(fcaRouter);
router.use(corroborationRouter);

export default router;
