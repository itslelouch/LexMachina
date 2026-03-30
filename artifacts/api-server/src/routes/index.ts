import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import casesRouter from "./cases.js";
import courtroomRouter from "./courtroom.js";
import witnessesRouter from "./witnesses.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(casesRouter);
router.use(courtroomRouter);
router.use(witnessesRouter);

export default router;
