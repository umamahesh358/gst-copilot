import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import productsRouter from "./products";
import customersRouter from "./customers";
import invoicesRouter from "./invoices";
import accountingRouter from "./accounting";
import aiRouter from "./ai";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(productsRouter);
router.use(customersRouter);
router.use(invoicesRouter);
router.use(accountingRouter);
router.use(aiRouter);
router.use(settingsRouter);

export default router;
