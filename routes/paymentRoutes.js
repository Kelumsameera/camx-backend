import express from "express";

import { generateHash, handleNotify, getPaymentStatus } from "../controllers/paymentController.js";

const router = express.Router();

router.post("/payhere/hash", generateHash);
router.post("/payhere/notify", handleNotify);
router.get("/payhere/status/:orderId", getPaymentStatus);

export default router;

// =========================================================
// In your server.js / app.js, mount this router:
//
//   import paymentRoutes from "./routes/paymentRoutes.js";
//   app.use("/api/payments", paymentRoutes);
//
// IMPORTANT: PayHere's notify_url callback is sent as
// 'application/x-www-form-urlencoded', not JSON. Make sure this
// middleware is registered BEFORE your routes:
//
//   app.use(express.urlencoded({ extended: true }));
//   app.use(express.json());
// =========================================================
