import express from "express"
import { createUser, loginUsers } from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.post("/",createUser);
userRouter.get("/", loginUsers);

export default userRouter;