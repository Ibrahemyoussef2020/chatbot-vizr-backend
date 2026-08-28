import { Router } from "express";
import { show } from "../controllers/landingContent.js";
import { publicRateLimit } from "../middlewares/publicRateLimit.middleware.js";
const landingRouter = Router();
landingRouter.get("/:slug", publicRateLimit, show);
export default landingRouter;
