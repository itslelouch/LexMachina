import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import casesRouter from "./cases.js";
import courtroomRouter from "./courtroom.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(casesRouter);
router.use(courtroomRouter);

export default router;
