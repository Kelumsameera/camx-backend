import express from "express";
import { createUser, loginUser, googleLogin, getAllUsers, updateUserStatus, getUser, sendOtp, validateOTPAndUpdatePassword } from "../controllers/userController.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const userRouter = express.Router();

// ======================================
// AUTH
// ======================================

userRouter.post("/", authLimiter, createUser);
userRouter.post("/login", authLimiter, loginUser);
userRouter.post("/google-login", authLimiter, googleLogin);
userRouter.get("/profile", requireAuth, getUser);

// OTP & Password Reset
userRouter.post("/otp/:email", authLimiter, sendOtp);
userRouter.post("/reset-password", authLimiter, validateOTPAndUpdatePassword);

// ======================================
// ADMIN
// ======================================

userRouter.get("/all", requireAdmin, getAllUsers);
userRouter.put("/status/:email", requireAdmin, updateUserStatus);

export default userRouter;
