import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js"; // Dashboard stats සඳහා User අවශ්‍ය වේ
import { isAdmin } from "./userController.js";

// ======================================
// CHECKOUT ORDER (WEB & POS SUPPORTED)
// ======================================

export async function checkoutOrder(req, res) {
  const items = req.body.items;

  // ======================================
  // VALIDATION
  // ======================================
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Cart is empty." });
  }

  try {
    const productUpdates = [];
    let calculatedTotal = 0;
    const formattedItems = [];

    // ======================================
    // CHECK PRODUCTS & UPDATE STOCK
    // ======================================
    for (const item of items) {
      const product = await Product.findOne({ productId: item.productId });

      if (!product) {
        return res
          .status(404)
          .json({ message: `Product ${item.productId} not found.` });
      }

      // STOCK CHECK
      if (product.stock < item.quantity) {
        return res
          .status(400)
          .json({ message: `Insufficient stock for ${product.name}.` });
      }

      // UPDATE STOCK
      product.stock -= item.quantity;
      if (product.stock <= 0) {
        product.isAvailable = false;
      }
      productUpdates.push(product.save());

      // යවන price එක හෝ Database එකේ price එක ගැනීම
      const itemPrice = item.price || item.unitPrice || product.price;

      formattedItems.push({
        productId: product.productId,
        name: product.name,
        quantity: item.quantity,
        unitPrice: itemPrice,
        image: product.images?.[0] || "",
      });

      // CALCULATE TOTAL
      calculatedTotal += item.quantity * itemPrice;
    }

    // SAVE ALL PRODUCTS (Stock update)
    await Promise.all(productUpdates);

    // ======================================
    // CREATE ORDER
    // ======================================
    // POS එකෙන් එනවා නම් සමහර දත්ත නැහැ. ඒ වෙනුවට "POS" කියලා Default දානවා.
    const isPOS =
      req.body.paymentMethod === "CASH" || req.body.paymentMethod === "CARD";

    const order = new Order({
      orderId: `ORD-${Date.now()}`,

      // USER & CONTACT INFO
      userEmail: req.user?.email || null,
      name: req.body.name || req.body.customerName || "Walk-in Customer",
      email: req.body.email || "pos-customer@store.local", // Required නිසා Dummy එකක් දානවා
      phone: req.body.phone || req.body.customerPhone || "N/A",
      address: req.body.address || (isPOS ? "Store Checkout" : ""),
      city: req.body.city || (isPOS ? "POS" : ""),
      district: req.body.district || (isPOS ? "POS" : ""),
      notes: req.body.notes || "",

      // PAYMENT & STATUS
      paymentMethod: req.body.paymentMethod || "COD",
      status: req.body.orderStatus || req.body.status || "paid",

      // PRICES (Frontend එකෙන් total එව්වෙ නැත්නම් ගණනය කළ එක ගන්නවා)
      subtotal: req.body.subtotal || calculatedTotal,
      shipping: req.body.shipping || 0,
      total: req.body.totalPrice || req.body.total || calculatedTotal,

      // POS ADVANCED FIELDS
      customerName: req.body.customerName || "Walk-in Customer",
      customerPhone: req.body.customerPhone || "",
      discountGiven: req.body.discountGiven || 0,

      // ITEMS
      items: formattedItems,
    });

    await order.save();

    // ======================================
    // RESPONSE
    // ======================================
    return res.status(201).json({
      message: "Order completed successfully.",
      order,
    });
  } catch (error) {
    console.error("CHECKOUT ERROR:", error);
    return res.status(500).json({
      message: "Error completing order.",
      error: error.message,
    });
  }
}

// ======================================
// GET ORDERS
// ======================================

export async function getOrders(req, res) {
  try {
    if (isAdmin(req)) {
      const orders = await Order.find().sort({ createdAt: -1 });
      return res.status(200).json(orders);
    }

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orders = await Order.find({ userEmail: req.user.email }).sort({
      createdAt: -1,
    });
    return res.status(200).json(orders);
  } catch (error) {
    console.error("GET ORDERS ERROR:", error);
    return res
      .status(500)
      .json({ message: "Error fetching orders.", error: error.message });
  }
}

// ======================================
// GET ORDER BY ID
// ======================================

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
    console.error("GET ORDER ERROR:", error);
    return res
      .status(500)
      .json({ message: "Error fetching order.", error: error.message });
  }
}

// ======================================
// SALES ANALYTICS
// ======================================

export async function getSalesAnalytics(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "Forbidden: Admins only." });
  }

  try {
    const orders = await Order.find();
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalProductsSold = orders.reduce(
      (sum, order) =>
        sum + order.items.reduce((count, item) => count + item.quantity, 0),
      0,
    );

    return res
      .status(200)
      .json({ totalOrders, totalRevenue, totalProductsSold });
  } catch (error) {
    console.error("ANALYTICS ERROR:", error);
    return res
      .status(500)
      .json({ message: "Error fetching analytics.", error: error.message });
  }
}

// ======================================
// DOWNLOAD CSV
// ======================================

export async function downloadOrdersCsv(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "Forbidden: Admins only." });
  }

  try {
    const orders = await Order.find();
    const rows = orders.map((order) => {
      const itemDescriptions = order.items
        .map((item) => `${item.name} x${item.quantity}`)
        .join("; ");
      return `${order.orderId},${order.createdAt.toISOString()},${order.status},${order.total},"${itemDescriptions}"`;
    });

    const csv = ["Order ID,Created At,Status,Total,Items", ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=camx-orders.csv",
    );
    return res.send(csv);
  } catch (error) {
    console.error("CSV EXPORT ERROR:", error);
    return res
      .status(500)
      .json({ message: "Error exporting orders.", error: error.message });
  }
}

// ======================================
// UPDATE ORDER STATUS
// ======================================

export async function updateOrderStatus(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "Forbidden: Admins only." });
  }

  try {
    const orderId = req.params.orderId;
    const status = req.body.status;
    await Order.updateOne({ orderId: orderId }, { $set: { status: status } });
    return res
      .status(200)
      .json({ message: "Order status updated successfully." });
  } catch (error) {
    console.error("UPDATE ORDER STATUS ERROR:", error);
    return res
      .status(500)
      .json({ message: "Error updating order status.", error: error.message });
  }
}

// ======================================
// DASHBOARD STATS
// ======================================

export async function getDashboardStats(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }

  try {
    const totalOrders = await Order.countDocuments();
    const revenueData = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]);
    const totalProducts = await Product.countDocuments();
    const totalCustomers = await User.countDocuments({ role: "user" });

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

    res.status(200).json({
      totalOrders,
      totalRevenue: revenueData[0]?.total || 0,
      totalProducts,
      totalCustomers,
      topProduct: topSelling[0] || null,
    });
  } catch (error) {
    console.error("DASHBOARD STATS ERROR:", error);
    res
      .status(500)
      .json({ message: "Error fetching stats", error: error.message });
  }
}

// ======================================
// COMPREHENSIVE ANALYTICS
// ======================================

export async function getComprehensiveAnalytics(req, res) {
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
                totalRevenue: { $sum: "$total" }, // Schema එකට අනුව "total" ලෙස වෙනස් කළා
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
                dailyRevenue: { $sum: "$total" }, // Schema එකට අනුව "total" ලෙස වෙනස් කළා
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
          // Schema එකට අනුව "$items.unitPrice" ලෙස වෙනස් කළා
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

    const overall = ordersStats[0].overall[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      totalProductsSold: 0,
    };
    const daily = ordersStats[0].daily[0] || {
      dailyOrders: 0,
      dailyRevenue: 0,
      dailyProductsSold: 0,
    };

    return res.status(200).json({ overall, daily, bestSellers });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching analytics", error: error.message });
  }
}
