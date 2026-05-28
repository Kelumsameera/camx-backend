import Order from "../models/order.js";

import Product from "../models/product.js";

import { isAdmin } from "./userController.js";

// ======================================
// CHECKOUT ORDER
// ======================================

export async function checkoutOrder(
  req,
  res
) {

  const items =
    req.body.items;

  // ======================================
  // VALIDATION
  // ======================================

  if (
    !Array.isArray(
      items
    ) ||
    items.length === 0
  ) {

    return res
      .status(400)
      .json({
        message:
          "Cart is empty.",
      });
  }

  try {

    const productUpdates =
      [];

    let total = 0;

    // ======================================
    // CHECK PRODUCTS
    // ======================================

    for (const item of items) {

      const product =
        await Product.findOne({
          productId:
            item.productId,
        });

      if (!product) {

        return res
          .status(404)
          .json({
            message:
              `Product ${item.productId} not found.`,
          });
      }

      // STOCK CHECK
      if (
        product.stock <
        item.quantity
      ) {

        return res
          .status(400)
          .json({
            message:
              `Insufficient stock for ${product.name}.`,
          });
      }

      // UPDATE STOCK
      product.stock -=
        item.quantity;

      if (
        product.stock <= 0
      ) {

        product.isAvailable =
          false;
      }

      productUpdates.push(
        product.save()
      );

      // CALCULATE TOTAL
      total +=
        item.quantity *
        item.unitPrice;
    }

    // SAVE PRODUCTS
    await Promise.all(
      productUpdates
    );

    // ======================================
    // CREATE ORDER
    // ======================================

    const order =
      new Order({

        orderId:
          `order-${Date.now()}`,

        // USER
        userEmail:
          req.user?.email ||
          null,

        name:
          req.body.name,

        email:
          req.body.email,

        phone:
          req.body.phone,

        address:
          req.body.address,

        city:
          req.body.city,

        district:
          req.body.district,

        notes:
          req.body.notes ||
          "",

        paymentMethod:
          req.body
            .paymentMethod ||
          "COD",

        // PRICES
        subtotal:
          req.body
            .subtotal || 0,

        shipping:
          req.body
            .shipping || 0,

        total,

        // ITEMS
        items,

        // STATUS
        status: "paid",
      });

    await order.save();

    // ======================================
    // RESPONSE
    // ======================================

    return res
      .status(201)
      .json({

        message:
          "Order completed successfully.",

        order,
      });

  } catch (error) {

    console.error(
      "CHECKOUT ERROR:",
      error
    );

    return res
      .status(500)
      .json({

        message:
          "Error completing order.",

        error:
          error.message,
      });
  }
}

// ======================================
// GET ORDERS
// ======================================

export async function getOrders(
  req,
  res
) {

  try {

    // ======================================
    // ADMIN
    // ======================================

    if (
      isAdmin(req)
    ) {

      const orders =
        await Order.find()
          .sort({
            createdAt: -1,
          });

      return res
        .status(200)
        .json(orders);
    }

    // ======================================
    // CUSTOMER
    // ======================================

    if (!req.user) {

      return res
        .status(401)
        .json({
          message:
            "Unauthorized",
        });
    }

    const orders =
      await Order.find({
        userEmail:
          req.user.email,
      }).sort({
        createdAt: -1,
      });

    return res
      .status(200)
      .json(orders);

  } catch (error) {

    console.error(
      "GET ORDERS ERROR:",
      error
    );

    return res
      .status(500)
      .json({

        message:
          "Error fetching orders.",

        error:
          error.message,
      });
  }
}

// ======================================
// GET ORDER BY ID
// ======================================

export async function getOrderById(
  req,
  res
) {

  try {

    const order =
      await Order.findOne({

        orderId:
          req.params.orderId,
      });

    if (!order) {

      return res
        .status(404)
        .json({

          message:
            "Order not found.",
        });
    }

    // ======================================
    // SECURITY
    // ======================================

    if (
      !isAdmin(req) &&
      req.user?.email !==
        order.userEmail
    ) {

      return res
        .status(403)
        .json({
          message:
            "Forbidden",
        });
    }

    return res
      .status(200)
      .json(order);

  } catch (error) {

    console.error(
      "GET ORDER ERROR:",
      error
    );

    return res
      .status(500)
      .json({

        message:
          "Error fetching order.",

        error:
          error.message,
      });
  }
}

// ======================================
// SALES ANALYTICS
// ======================================

export async function getSalesAnalytics(
  req,
  res
) {

  if (
    !isAdmin(req)
  ) {

    return res
      .status(403)
      .json({

        message:
          "Forbidden: Admins only.",
      });
  }

  try {

    const orders =
      await Order.find();

    const totalOrders =
      orders.length;

    const totalRevenue =
      orders.reduce(

        (
          sum,
          order
        ) =>
          sum +
          order.total,

        0
      );

    const totalProductsSold =
      orders.reduce(

        (
          sum,
          order
        ) =>

          sum +

          order.items.reduce(

            (
              count,
              item
            ) =>

              count +
              item.quantity,

            0
          ),

        0
      );

    return res
      .status(200)
      .json({

        totalOrders,

        totalRevenue,

        totalProductsSold,
      });

  } catch (error) {

    console.error(
      "ANALYTICS ERROR:",
      error
    );

    return res
      .status(500)
      .json({

        message:
          "Error fetching analytics.",

        error:
          error.message,
      });
  }
}

// ======================================
// DOWNLOAD CSV
// ======================================

export async function downloadOrdersCsv(
  req,
  res
) {

  if (
    !isAdmin(req)
  ) {

    return res
      .status(403)
      .json({

        message:
          "Forbidden: Admins only.",
      });
  }

  try {

    const orders =
      await Order.find();

    const rows =
      orders.map(
        (
          order
        ) => {

          const itemDescriptions =
            order.items
              .map(
                (
                  item
                ) =>

                  `${item.name} x${item.quantity}`
              )
              .join("; ");

          return `${order.orderId},${order.createdAt.toISOString()},${order.status},${order.total},"${itemDescriptions}"`;
        }
      );

    const csv = [

      "Order ID,Created At,Status,Total,Items",

      ...rows,

    ].join("\n");

    res.setHeader(
      "Content-Type",
      "text/csv"
    );

    res.setHeader(

      "Content-Disposition",

      "attachment; filename=camx-orders.csv"
    );

    return res.send(csv);

  } catch (error) {

    console.error(
      "CSV EXPORT ERROR:",
      error
    );

    return res
      .status(500)
      .json({

        message:
          "Error exporting orders.",

        error:
          error.message,
      });
  }
}

export async function updateOrderStatus(
  req,
  res
) {

    if (
      !isAdmin(req)
    ) {

      return res
        .status(403)
        .json({

          message:
            "Forbidden: Admins only.",
        });
    }

    try {

      const orderId =
        req.params.orderId;

      const status =
        req.body.status;

      await Order.updateOne(
        { orderId: orderId },
        { $set: { status: status } }
      );

      return res
        .status(200)
        .json({
          message:
            "Order status updated successfully.",
        });

    } catch (error) {

      console.error(
        "UPDATE ORDER STATUS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            "Error updating order status.",
          error:
            error.message,
        });
    }
}


export async function getDashboardStats(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "Forbidden: Admins only" });
  }

  try {
    const totalOrders = await Order.countDocuments();
    
    // Revenue ගණනය කිරීම
    const revenueData = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);
    
    const totalProducts = await Product.countDocuments();
    const totalCustomers = await User.countDocuments({ role: "user" });

    // Top Selling Product සොයා ගැනීම
    const topSelling = await Order.aggregate([
      { $unwind: "$items" },
      { 
        $group: { 
          _id: "$items.productId", 
          totalSold: { $sum: "$items.quantity" }, 
          name: { $first: "$items.name" }, 
          price: { $first: "$items.unitPrice" } 
        } 
      },
      { $sort: { totalSold: -1 } },
      { $limit: 1 }
    ]);

    res.status(200).json({
      totalOrders,
      totalRevenue: revenueData[0]?.total || 0,
      totalProducts,
      totalCustomers,
      topProduct: topSelling[0] || null
    });
  } catch (error) {
    console.error("DASHBOARD STATS ERROR:", error);
    res.status(500).json({ message: "Error fetching stats", error: error.message });
  }
}