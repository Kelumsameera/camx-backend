import express from "express";
import {
  checkoutOrder,
  getOrders,
  getOrderById,
  getSalesAnalytics,
  downloadOrdersCsv,
} from "../controllers/orderController.js";

const orderRouter = express.Router();

orderRouter.post("/checkout", checkoutOrder);
orderRouter.get("/", getOrders);
orderRouter.get("/analytics/sales", getSalesAnalytics);
orderRouter.get("/download", downloadOrdersCsv);
orderRouter.get("/:orderId", getOrderById);

export default orderRouter;
