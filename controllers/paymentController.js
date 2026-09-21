import crypto from "crypto";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import logger from "../utils/logger.js";
import { isAdmin } from "../middleware/auth.js";

const CURRENCY = "LKR";

function formatAmount(value) {
  // PayHere requires exactly 2 decimals, no thousand separators, e.g. "7900.00"
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

function md5(input) {
  return crypto.createHash("md5").update(input).digest("hex").toUpperCase();
}

// Restore stock if card payment fails or is cancelled
async function restoreStock(order) {
  if (order.stockRestored) return;

  await Promise.all(
    order.items.map(async (item) => {
      const updated = await Product.findOneAndUpdate({ productId: item.productId }, { $inc: { stock: item.quantity }, $set: { isAvailable: true } });
      if (!updated) {
        logger.warn("Could not find product to restore stock", { productId: item.productId });
      }
    }),
  );
}

// =========================================================
// POST /api/payments/payhere/hash (CAMX-006)
// =========================================================
export const generateHash = async (req, res) => {
  try {
    const { orderId } = req.body;
    const merchantId = process.env.PAYHERE_MERCHANT_ID;
    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    const sandbox = process.env.PAYHERE_SANDBOX === "true";

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required" });
    }

    if (!merchantId || !merchantSecret) {
      logger.error("PayHere merchant credentials are not configured in environment");
      return res.status(500).json({ success: false, message: "Payment gateway not configured" });
    }

    // Find order by Mongo _id or custom orderId
    const order = await Order.findOne({
      $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { orderId }],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Authorization: If user is authenticated, ensure order ownership or admin
    if (req.user && !isAdmin(req)) {
      if (order.userEmail && req.user.email.toLowerCase() !== order.userEmail.toLowerCase()) {
        return res.status(403).json({ success: false, message: "Forbidden: Not authorized for this order" });
      }
    }

    // Reset status to pending for CARD payment attempts if not already paid
    if (order.paymentMethod === "CARD" && order.paymentStatus !== "Paid") {
      order.status = "pending";
      order.paymentStatus = "Pending";
      await order.save();
    }

    // Authoritative amount read directly from DB order record
    const amount = formatAmount(order.total);
    const secretHash = md5(merchantSecret);
    const hash = md5(`${merchantId}${order._id}${amount}${CURRENCY}${secretHash}`);

    const fullName = (order.name || "Customer").trim();
    const [firstName, ...rest] = fullName.split(" ");

    return res.status(200).json({
      sandbox,
      merchant_id: merchantId,
      order_id: String(order._id),
      amount,
      currency: CURRENCY,
      hash,
      first_name: firstName || "Customer",
      last_name: rest.join(" ") || "-",
      email: order.email,
      phone: order.phone,
      address: order.address,
      city: order.city,
    });
  } catch (error) {
    logger.error("PayHere hash generation error", error);
    return res.status(500).json({ success: false, message: "Failed to generate payment hash" });
  }
};

// =========================================================
// POST /api/payments/payhere/notify (CAMX-007)
// =========================================================
export const handleNotify = async (req, res) => {
  try {
    const { merchant_id, order_id, payment_id, payhere_amount, payhere_currency, status_code, md5sig, method } = req.body;

    const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;

    if (!merchantSecret) {
      logger.error("PAYHERE_MERCHANT_SECRET missing — cannot verify notify callback");
      return res.status(200).send("OK");
    }

    // 1. Signature Verification
    const secretHash = md5(merchantSecret);
    const localSig = md5(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${secretHash}`);

    if (localSig !== md5sig) {
      logger.security("PayHere notify: signature mismatch — possible spoofed request", {
        order_id,
        merchant_id,
      });
      return res.status(200).send("OK");
    }

    // 2. Load Order from DB
    const order = await Order.findOne({
      $or: [{ _id: order_id.match(/^[0-9a-fA-F]{24}$/) ? order_id : null }, { orderId: order_id }],
    });

    if (!order) {
      logger.warn("PayHere notify: order not found in DB", { order_id });
      return res.status(200).send("OK");
    }

    // 3. Validate Amount & Currency matches DB record authoritatively
    const expectedAmount = formatAmount(order.total);
    if (payhere_amount !== expectedAmount || payhere_currency !== CURRENCY) {
      logger.security("PayHere notify: Amount or currency tampering detected", {
        orderId: order._id,
        receivedAmount: payhere_amount,
        expectedAmount,
        receivedCurrency: payhere_currency,
      });
      return res.status(200).send("OK");
    }

    const paymentStatusMap = {
      2: "Paid",
      0: "Pending",
      "-1": "Cancelled",
      "-2": "Failed",
      "-3": "Chargedback",
    };

    const newPaymentStatus = paymentStatusMap[String(status_code)] || "Pending";

    // Idempotency: Ignore if already marked as Paid
    if (order.paymentStatus === "Paid" && newPaymentStatus === "Paid") {
      logger.info("PayHere notify: duplicate payment confirmation ignored", { orderId: order._id });
      return res.status(200).send("OK");
    }

    order.paymentStatus = newPaymentStatus;
    order.payhere = {
      paymentId: payment_id,
      method,
      statusCode: String(status_code),
    };

    if (newPaymentStatus === "Paid") {
      order.status = "paid";
    }

    // Payment failed / cancelled / chargedback -> Restore inventory safely once
    const isDeadEnd = ["Failed", "Cancelled", "Chargedback"].includes(newPaymentStatus);
    if (isDeadEnd && order.paymentMethod === "CARD" && !order.stockRestored) {
      await restoreStock(order);
      order.stockRestored = true;
      order.status = "cancelled";
    }

    await order.save();
    logger.info("PayHere notify processed successfully", { orderId: order._id, paymentStatus: newPaymentStatus });

    return res.status(200).send("OK");
  } catch (error) {
    logger.error("PayHere notify error", error);
    return res.status(200).send("OK");
  }
};

// =========================================================
// GET /api/payments/payhere/status/:orderId (CAMX-008)
// =========================================================
export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      $or: [{ _id: orderId.match(/^[0-9a-fA-F]{24}$/) ? orderId : null }, { orderId }],
    }).select("paymentStatus status total userEmail");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Authorization: User must be owner of the order or Admin
    if (req.user && !isAdmin(req)) {
      if (order.userEmail && req.user.email.toLowerCase() !== order.userEmail.toLowerCase()) {
        return res.status(403).json({ success: false, message: "Forbidden: Not authorized to view this payment status" });
      }
    }

    return res.status(200).json({
      success: true,
      paymentStatus: order.paymentStatus,
      status: order.status,
      total: order.total,
    });
  } catch (error) {
    logger.error("PayHere status check error", error);
    return res.status(500).json({ success: false, message: "Failed to check payment status" });
  }
};

export default { generateHash, handleNotify, getPaymentStatus };
