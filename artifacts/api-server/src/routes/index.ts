import { Router, type IRouter } from "express";
import healthRouter from "./health";
import investigatorsRouter from "./investigators";
import { eventsRouter } from "./events";
import newsRouter from "./news";
import { pushRouter } from "./push";
import weatherRouter from "./weather";
import equipmentRouter from "./equipment";
import supportingResourcesSheetRouter from "./supporting-resources-sheet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(investigatorsRouter);
router.use(eventsRouter);
router.use(newsRouter);
router.use(pushRouter);
router.use(weatherRouter);
router.use(equipmentRouter);
router.use(supportingResourcesSheetRouter);

export default router;
