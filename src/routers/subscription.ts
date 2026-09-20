import { Router } from "express";
import { startFreePlan, subscribe, subscriptionStatus } from "../controllers/subscription.js";
import { authenticate } from "../middlewares/index.js";

const subscriptionRouter = Router();

subscriptionRouter.post("/subscribe", subscribe);
subscriptionRouter.post("/onboarding/subscribe", authenticate, subscribe);
subscriptionRouter.post("/onboarding/free-plan", authenticate, startFreePlan);
subscriptionRouter.get("/onboarding/status", authenticate, subscriptionStatus);

export default subscriptionRouter;
