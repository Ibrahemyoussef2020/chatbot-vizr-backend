import { Router } from "express";
import { subscribe } from "../controllers/subscription.js";

const subscriptionRouter = Router();

subscriptionRouter.post("/subscribe", subscribe);

export default subscriptionRouter;
