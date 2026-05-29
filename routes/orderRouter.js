import express from "express";
import {
  checkoutOrder,
  getOrders,
  getOrderById,
  getSalesAnalytics,
  downloadOrdersCsv,
  updateOrderStatus,
  getComprehensiveAnalytics, // අලුත් Analytics එක
} from "../controllers/orderController.js";

const orderRouter = express.Router();

orderRouter.post("/checkout", checkoutOrder);
orderRouter.get("/", getOrders);
orderRouter.get("/analytics/sales", getSalesAnalytics);
orderRouter.get("/analytics/comprehensive", getComprehensiveAnalytics); // අලුත් එක
orderRouter.get("/download", downloadOrdersCsv);

orderRouter.get("/:orderId", getOrderById); // අනිවාර්යයෙන්ම පහළින් තිබිය යුතුය
orderRouter.put("/:orderId", updateOrderStatus);

export default orderRouter;
