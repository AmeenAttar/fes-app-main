import { Router, type IRouter } from "express";
import healthRouter from "./health";
import investigatorsRouter from "./investigators";
import { eventsRouter } from "./events";
import { pushRouter } from "./push";

const router: IRouter = Router();

router.use(healthRouter);
router.use(investigatorsRouter);
router.use(eventsRouter);
router.use(pushRouter);

export default router;
