import express from "express";
import { 
  createUser, 
  loginUser, 
  googleLogin // 1. Controller එකෙන් googleLogin ශ්‍රිතය මෙතැනට import කරන්න
} from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.post("/", createUser);
userRouter.post("/login", loginUser);

// 2. Google Login සඳහා වන නව Backend Route එක මෙතැනින් එකතු කරන්න
userRouter.post("/google-login", googleLogin);

export default userRouter;
