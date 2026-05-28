import express from "express";

import {

  createUser,

  loginUser,

  googleLogin,

  getAllUsers,

  updateUserStatus,

} from "../controllers/userController.js";

const userRouter =
  express.Router();

// ======================================
// AUTH
// ======================================

userRouter.post(
  "/",
  createUser
);

userRouter.post(
  "/login",
  loginUser
);

userRouter.post(
  "/google-login",
  googleLogin
);

// ======================================
// ADMIN
// ======================================

userRouter.get(
  "/all",
  getAllUsers
);

userRouter.put(
  "/status/:email",
  updateUserStatus
);

// ======================================
// EXPORT
// ======================================

export default userRouter;