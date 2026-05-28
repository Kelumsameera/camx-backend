import express from "express";
import {
  checkoutOrder,
  getOrders,
  getOrderById,
  getSalesAnalytics,
  downloadOrdersCsv,
  updateOrderStatus,
  getDashboardStats,
} from "../controllers/orderController.js";

const orderRouter = express.Router();

orderRouter.post("/checkout", checkoutOrder);
orderRouter.get("/", getOrders);
orderRouter.get("/analytics/sales", getSalesAnalytics);
orderRouter.get("/download", downloadOrdersCsv);
orderRouter.get("/:orderId", getOrderById);
orderRouter.put(
  "/:orderId",
  updateOrderStatus
);
orderRouter.get("/analytics/dashboard", getDashboardStats);

export default orderRouter;
