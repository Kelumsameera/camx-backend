import express from "express";
import { checkoutOrder, getOrders, getOrderById, getSalesAnalytics, downloadOrdersCsv, updateOrderStatus, getComprehensiveAnalytics, getDashboardStats } from "../controllers/orderController.js";
import { requireAdmin } from "../middleware/auth.js";
import { checkoutLimiter } from "../middleware/rateLimiter.js";

const orderRouter = express.Router();

orderRouter.post("/checkout", checkoutLimiter, checkoutOrder);
orderRouter.get("/", getOrders);

// Admin-protected analytics & export routes
orderRouter.get("/analytics/sales", requireAdmin, getSalesAnalytics);
orderRouter.get("/analytics/comprehensive", requireAdmin, getComprehensiveAnalytics);
orderRouter.get("/analytics/dashboard", requireAdmin, getDashboardStats);
orderRouter.get("/download", requireAdmin, downloadOrdersCsv);

orderRouter.get("/:orderId", getOrderById);
orderRouter.put("/:orderId", requireAdmin, updateOrderStatus);

export default orderRouter;
