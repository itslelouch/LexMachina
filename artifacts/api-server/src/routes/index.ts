import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import casesRouter from "./cases.js";
import courtroomRouter from "./courtroom.js";
import witnessesRouter from "./witnesses.js";
import evidenceRouter from "./evidence.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(casesRouter);
router.use(courtroomRouter);
router.use(witnessesRouter);
router.use(evidenceRouter);

export default router;
