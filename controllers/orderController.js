import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { isAdmin } from "../middleware/auth.js";
import logger from "../utils/logger.js";
import { generateCsv } from "../utils/csvSanitizer.js";
import { parsePagination } from "../middleware/validate.js";

// ======================================
// CHECKOUT ORDER (SECURE, ATOMIC, IDEMPOTENT)
// (CAMX-002, CAMX-003, CAMX-004)
// ======================================
export async function checkoutOrder(req, res) {
  const { items } = req.body;
  const idempotencyKey = req.header("idempotency-key") || req.body.idempotencyKey;

  // Validation of cart items array
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Cart is empty." });
  }

  // Idempotency check: if request was already processed with this key, return the existing order
  if (idempotencyKey) {
    try {
      const existingOrder = await Order.findOne({ idempotencyKey });
      if (existingOrder) {
        logger.info("Idempotent checkout returned existing order", {
          idempotencyKey,
          orderId: existingOrder.orderId,
        });
        return res.status(200).json({
          success: true,
          message: "Order already processed (idempotent response).",
          order: existingOrder,
        });
      }
    } catch (err) {
      logger.error("Error checking idempotency key", err);
    }
  }

  // Deducted products tracking for rollback on partial failure
  const successfulDeductions = [];

  try {
    let calculatedSubtotal = 0;
    const formattedItems = [];

    // Phase 1: Validate items & product existence
    for (const item of items) {
      const quantity = parseInt(item.quantity, 10);
      if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for product ${item.productId || "unknown"}.`,
        });
      }

      if (!item.productId) {
        return res.status(400).json({ success: false, message: "Missing productId for an item in cart." });
      }
    }

    // Phase 2: Atomic inventory deduction with rollback
    for (const item of items) {
      const quantity = parseInt(item.quantity, 10);

      // ATOMIC UPDATE: Only decrement if stock >= requested quantity
      const updatedProduct = await Product.findOneAndUpdate({ productId: item.productId, stock: { $gte: quantity } }, { $inc: { stock: -quantity } }, { returnDocument: "after" });

      if (!updatedProduct) {
        // Stock is insufficient or product does not exist -> ROLLBACK ALL PREVIOUS DEDUCTIONS
        logger.warn("Insufficient stock during checkout, initiating rollback", {
          productId: item.productId,
          requestedQty: quantity,
        });

        // Rollback already deducted products
        for (const deduction of successfulDeductions) {
          await Product.updateOne({ productId: deduction.productId }, { $inc: { stock: deduction.quantity } });
        }

        const productDoc = await Product.findOne({ productId: item.productId });
        const productName = productDoc ? productDoc.name : item.productId;
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${productName}.`,
        });
      }

      // Track successful deduction for rollback if subsequent items fail
      successfulDeductions.push({
        productId: item.productId,
        quantity,
      });

      // Update availability flag if stock reaches 0
      if (updatedProduct.stock <= 0) {
        await Product.updateOne({ productId: item.productId }, { $set: { isAvailable: false } });
      }

      // Authoritative DB price only (NEVER trust client-provided price)
      const authoritativeUnitPrice = Number(updatedProduct.price) || 0;
      const itemTotal = authoritativeUnitPrice * quantity;
      calculatedSubtotal += itemTotal;

      formattedItems.push({
        productId: updatedProduct.productId,
        name: updatedProduct.name,
        quantity,
        unitPrice: authoritativeUnitPrice,
        image: updatedProduct.images?.[0] || "",
      });
    }

    // Phase 3: Authoritative Financial Calculation
    const isPOS = req.body.paymentMethod === "CASH" || req.body.paymentMethod === "CARD";

    // Shipping: default 0 or calculate authoritatively
    const shipping = typeof req.body.shipping === "number" && req.body.shipping >= 0 ? req.body.shipping : 0;

    // Server-calculated final total (client totals are completely ignored)
    const finalTotal = Math.max(0, calculatedSubtotal + shipping);

    const orderStatus = isPOS ? "COMPLETED" : req.body.paymentMethod === "CARD" ? "pending" : "paid";
    const paymentStatus = req.body.paymentMethod === "CARD" ? "Pending" : isPOS ? "Paid" : "Pending";

    const order = new Order({
      orderId: `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      idempotencyKey: idempotencyKey || undefined,

      userEmail: req.user?.email || (req.body.email ? req.body.email.trim().toLowerCase() : null),
      name: (req.body.name || req.body.customerName || "Walk-in Customer").trim(),
      email: (req.body.email || "pos-customer@store.local").trim().toLowerCase(),
      phone: (req.body.phone || req.body.customerPhone || "N/A").trim(),
      address: req.body.address || (isPOS ? "Store Checkout" : "N/A"),
      city: req.body.city || (isPOS ? "POS" : "N/A"),
      district: req.body.district || (isPOS ? "POS" : "N/A"),
      notes: req.body.notes || "",

      paymentMethod: req.body.paymentMethod || "COD",
      paymentStatus,
      status: orderStatus,

      // Authoritative calculated prices
      subtotal: calculatedSubtotal,
      shipping,
      total: finalTotal,

      customerName: req.body.customerName || "Walk-in Customer",
      customerPhone: req.body.customerPhone || "",
      discountGiven: 0,

      items: formattedItems,
    });

    await order.save();

    logger.info("Order created successfully", { orderId: order.orderId, total: finalTotal });

    return res.status(201).json({
      success: true,
      message: "Order completed successfully.",
      order,
    });
  } catch (error) {
    logger.error("CHECKOUT ERROR, executing rollback", error);

    // Rollback any stock deducted before error occurred
    for (const deduction of successfulDeductions) {
      try {
        await Product.updateOne({ productId: deduction.productId }, { $inc: { stock: deduction.quantity } });
      } catch (rollbackErr) {
        logger.error("Stock rollback failure", rollbackErr, { deduction });
      }
    }

    return res.status(500).json({
      success: false,
      message: "Error completing order.",
    });
  }
}

// ======================================
// GET ORDERS (CAMX-013, CAMX-025)
// ======================================
export async function getOrders(req, res) {
  try {
    const { page, limit, skip } = parsePagination(req, 20, 100);

    if (isAdmin(req)) {
      const orders = await Order.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
      return res.status(200).json(orders);
    }

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const orders = await Order.find({ userEmail: req.user.email }).sort({ createdAt: -1 }).skip(skip).limit(limit);

    return res.status(200).json(orders);
  } catch (error) {
    logger.error("GET ORDERS ERROR", error);
    return res.status(500).json({ success: false, message: "Error fetching orders." });
  }
}

// ======================================
// GET ORDER BY ID (CAMX-008, CAMX-013)
// ======================================
export async function getOrderById(req, res) {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Allow Admin OR the user who owns the order
    const isOwner = req.user && req.user.email && order.userEmail && req.user.email.toLowerCase() === order.userEmail.toLowerCase();

    if (!isAdmin(req) && !isOwner) {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied to this order" });
    }

    return res.status(200).json(order);
  } catch (error) {
    logger.error("GET ORDER ERROR", error);
    return res.status(500).json({ success: false, message: "Error fetching order." });
  }
}

// ======================================
// SALES ANALYTICS (ADMIN ONLY) (CAMX-009)
// ======================================
export async function getSalesAnalytics(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: "Forbidden: Admins only." });
  }

  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$total" },
          totalProductsSold: { $sum: { $sum: "$items.quantity" } },
        },
      },
    ]);

    const result = stats[0] || { totalOrders: 0, totalRevenue: 0, totalProductsSold: 0 };
    return res.status(200).json({
      totalOrders: result.totalOrders,
      totalRevenue: result.totalRevenue,
      totalProductsSold: result.totalProductsSold,
    });
  } catch (error) {
    logger.error("ANALYTICS ERROR", error);
    return res.status(500).json({ success: false, message: "Error fetching analytics." });
  }
}

// ======================================
// DOWNLOAD CSV (CAMX-022)
// ======================================
export async function downloadOrdersCsv(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: "Forbidden: Admins only." });
  }

  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(1000);

    const headers = ["Order ID", "Created At", "Status", "Payment Method", "Total (LKR)", "Items"];
    const rows = orders.map((order) => {
      const itemDescriptions = order.items.map((item) => `${item.name} x${item.quantity}`).join("; ");
      return [order.orderId, order.createdAt ? order.createdAt.toISOString() : "", order.status, order.paymentMethod, order.total, itemDescriptions];
    });

    const csvData = generateCsv(headers, rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=camx-orders.csv");
    return res.status(200).send(csvData);
  } catch (error) {
    logger.error("CSV EXPORT ERROR", error);
    return res.status(500).json({ success: false, message: "Error exporting orders." });
  }
}

// ======================================
// UPDATE ORDER STATUS (ADMIN ONLY) (CAMX-014)
// ======================================
export async function updateOrderStatus(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: "Forbidden: Admins only." });
  }

  const { orderId } = req.params;
  const { status } = req.body;

  const validStatuses = ["pending", "paid", "fulfilled", "cancelled", "COMPLETED"];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid order status. Allowed values: ${validStatuses.join(", ")}`,
    });
  }

  try {
    const order = await Order.findOneAndUpdate({ orderId }, { $set: { status } }, { returnDocument: "after" });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    logger.info("Order status updated", { orderId, status });
    return res.status(200).json({ success: true, message: "Order status updated successfully.", order });
  } catch (error) {
    logger.error("UPDATE ORDER STATUS ERROR", error);
    return res.status(500).json({ success: false, message: "Error updating order status." });
  }
}

// ======================================
// DASHBOARD STATS (ADMIN ONLY)
// ======================================
export async function getDashboardStats(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: "Forbidden: Admins only" });
  }

  try {
    const totalOrders = await Order.countDocuments();
    const revenueData = await Order.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }]);
    const totalProducts = await Product.countDocuments();
    const totalCustomers = await User.countDocuments({ role: { $in: ["user", "customer"] } });

    const topSelling = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" },
          name: { $first: "$items.name" },
          price: { $first: "$items.unitPrice" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 1 },
    ]);

    return res.status(200).json({
      totalOrders,
      totalRevenue: revenueData[0]?.total || 0,
      totalProducts,
      totalCustomers,
      topProduct: topSelling[0] || null,
    });
  } catch (error) {
    logger.error("DASHBOARD STATS ERROR", error);
    return res.status(500).json({ success: false, message: "Error fetching stats" });
  }
}

// ======================================
// COMPREHENSIVE ANALYTICS (ADMIN ONLY) (CAMX-009)
// ======================================
export async function getComprehensiveAnalytics(req, res) {
  // REQUIRE ADMIN AUTH (CAMX-009)
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: "Forbidden: Admins only." });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const ordersStats = await Order.aggregate([
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: "$total" },
                totalProductsSold: { $sum: { $sum: "$items.quantity" } },
              },
            },
          ],
          daily: [
            { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
            {
              $group: {
                _id: null,
                dailyOrders: { $sum: 1 },
                dailyRevenue: { $sum: "$total" },
                dailyProductsSold: { $sum: { $sum: "$items.quantity" } },
              },
            },
          ],
        },
      },
    ]);

    const bestSellers = await Order.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" },
          revenue: {
            $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] },
          },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "productId",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: "$productInfo.name",
          totalSold: 1,
          revenue: 1,
        },
      },
    ]);

    const overall = ordersStats[0]?.overall[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      totalProductsSold: 0,
    };
    const daily = ordersStats[0]?.daily[0] || {
      dailyOrders: 0,
      dailyRevenue: 0,
      dailyProductsSold: 0,
    };

    return res.status(200).json({ overall, daily, bestSellers });
  } catch (error) {
    logger.error("COMPREHENSIVE ANALYTICS ERROR", error);
    return res.status(500).json({ success: false, message: "Error fetching analytics" });
  }
}
