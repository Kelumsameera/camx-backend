import Order from "../models/order.js";
import Product from "../models/product.js";
import { isAdmin } from "./userController.js";

export async function checkoutOrder(req, res) {
  const items = req.body.items;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Cart is empty." });
  }

  try {
    const productUpdates = [];
    let total = 0;

    for (const item of items) {
      const product = await Product.findOne({ productId: item.productId });
      if (!product) {
        return res.status(404).json({ message: `Product ${item.productId} not found.` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}.` });
      }
      product.stock -= item.quantity;
      if (product.stock <= 0) {
        product.isAvailable = false;
      }
      productUpdates.push(product.save());
      total += item.quantity * item.unitPrice;
    }

    await Promise.all(productUpdates);

    const order = new Order({
      orderId: `order-${Date.now()}`,
      userEmail: req.user?.email || null,
      items,
      total,
      status: "paid",
    });

    await order.save();

    return res.status(201).json({ message: "Order completed.", order });
  } catch (error) {
    return res.status(500).json({ message: "Error completing order.", error: error.message });
  }
}

export async function getOrders(req, res) {
  try {
    if (isAdmin(req)) {
      const orders = await Order.find().sort({ createdAt: -1 });
      return res.status(200).json(orders);
    }

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orders = await Order.find({ userEmail: req.user.email }).sort({ createdAt: -1 });
    return res.status(200).json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching orders.", error: error.message });
  }
}

export async function getOrderById(req, res) {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (!isAdmin(req) && req.user?.email !== order.userEmail) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json(order);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching order.", error: error.message });
  }
}

export async function getSalesAnalytics(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "Forbidden: Admins only." });
  }

  try {
    const orders = await Order.find();
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalProductsSold = orders.reduce(
      (sum, order) => sum + order.items.reduce((count, item) => count + item.quantity, 0),
      0
    );

    return res.status(200).json({ totalOrders, totalRevenue, totalProductsSold });
  } catch (error) {
    return res.status(500).json({ message: "Error fetching analytics.", error: error.message });
  }
}

export async function downloadOrdersCsv(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "Forbidden: Admins only." });
  }

  try {
    const orders = await Order.find();
    const rows = orders.map((order) => {
      const itemDescriptions = order.items.map((item) => `${item.name} x${item.quantity}`).join("; ");
      return `${order.orderId},${order.createdAt.toISOString()},${order.status},${order.total},"${itemDescriptions}"`;
    });

    const csv = ["Order ID,Created At,Status,Total,Items", ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=camx-orders.csv");
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ message: "Error exporting orders.", error: error.message });
  }
}
