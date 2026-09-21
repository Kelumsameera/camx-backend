import express from "express";
import { generateHash, handleNotify, getPaymentStatus } from "../controllers/paymentController.js";
import { checkoutLimiter } from "../middleware/rateLimiter.js";

const paymentRouter = express.Router();

paymentRouter.post("/payhere/hash", checkoutLimiter, generateHash);
paymentRouter.post("/payhere/notify", handleNotify);
paymentRouter.get("/payhere/status/:orderId", getPaymentStatus);

export default paymentRouter;
