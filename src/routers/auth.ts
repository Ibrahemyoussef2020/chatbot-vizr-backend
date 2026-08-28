import { Router } from "express";
import multer from "multer";
import validateRequest from "../middlewares/validateRequest.middleware.js";
import { registerValidator, loginValidator } from "../validator/index.js";
import { authController } from "../controllers/index.js";

const upload = multer({
    storage: multer.memoryStorage(),
});

const authRouter = Router();

authRouter.post("/register", upload.any(), registerValidator, validateRequest, authController.register);
authRouter.post("/signup", upload.any(), registerValidator, validateRequest, authController.register);

authRouter.post("/login", loginValidator, validateRequest, authController.login);

authRouter.post("/logout", authController.logout);
authRouter.get("/logout", authController.logout);

authRouter.get("/auth-status", authController.checkStatus);
authRouter.get("/status", authController.checkStatus);
authRouter.get("/profile", authController.profile);

export default authRouter;
