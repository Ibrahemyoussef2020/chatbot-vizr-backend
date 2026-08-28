import { Router } from "express";
import { userController } from "../controllers/index.js";
const userRouter = Router();
userRouter.get("/", userController.getAllUsers);
export default userRouter;  