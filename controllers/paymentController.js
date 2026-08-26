import crypto from "crypto";

import Order from "../models/Order.js";
import Product from "../models/Product.js";

const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID;
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET;
const SANDBOX = process.env.PAYHERE_SANDBOX !== "true"; // default true (sandbox) unless explicitly "false"
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

// checkoutOrder() deducts stock at order-creation time, before a CARD
// payment is actually confirmed. If the payment fails/is cancelled, that
// stock needs to go back — otherwise it's lost forever for a sale that
// never happened.
async function restoreStock(order) {
  await Promise.all(
    order.items.map(async (item) => {
      const product = await Product.findOne({ productId: item.productId });

      if (product) {
        product.stock += item.quantity;
        product.isAvailable = true;
        await product.save();
      }
    }),
  );
}

// =========================================================
// POST /api/payments/payhere/hash
// Body: { orderId }  (this is the Mongo _id, not the human-readable orderId field)
//
// Amount/currency ALWAYS read from the order stored in the DB — never
// trust an amount sent by the client. merchant_secret never leaves this server.
// =========================================================
export const generateHash = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    if (!MERCHANT_ID || !MERCHANT_SECRET) {
      console.error("PayHere merchant credentials are not configured — check PAYHERE_MERCHANT_ID / PAYHERE_MERCHANT_SECRET in .env");
      return res.status(500).json({ message: "Payment gateway not configured" });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Safety net: your checkout controller's `status` default is "paid",
    // which is fine for COD/BankTransfer but WRONG for a card order that
    // hasn't been paid yet. Force it back to pending here before starting
    // the payment popup, regardless of what the checkout controller set.
    if (order.paymentMethod === "CARD" && (order.status === "paid" || order.paymentStatus !== "Pending")) {
      order.status = "pending";
      order.paymentStatus = "Pending";
      await order.save();
    }

    const amount = formatAmount(order.total);
    const secretHash = md5(MERCHANT_SECRET);
    const hash = md5(`${MERCHANT_ID}${order._id}${amount}${CURRENCY}${secretHash}`);

    const fullName = (order.name || "Customer").trim();
    const [firstName, ...rest] = fullName.split(" ");

    return res.json({
      sandbox: SANDBOX,
      merchant_id: MERCHANT_ID,
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
    console.error("PayHere hash generation error:", error);
    return res.status(500).json({ message: "Failed to generate payment hash" });
  }
};

// =========================================================
// POST /api/payments/payhere/notify
// PayHere calls this server-to-server after processing the payment
// (this URL MUST be publicly reachable — not localhost).
//
// Body is 'application/x-www-form-urlencoded' — make sure
// express.urlencoded({ extended: true }) is registered in server.js.
//
// MUST always respond 200, otherwise PayHere keeps retrying the callback.
// =========================================================
export const handleNotify = async (req, res) => {
  try {
    const { merchant_id, order_id, payment_id, payhere_amount, payhere_currency, status_code, md5sig, method } = req.body;

    if (!MERCHANT_SECRET) {
      console.error("PAYHERE_MERCHANT_SECRET missing — cannot verify notify callback");
      return res.status(200).send("OK");
    }

    const secretHash = md5(MERCHANT_SECRET);
    const localSig = md5(`${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${secretHash}`);

    if (localSig !== md5sig) {
      console.warn("PayHere notify: signature mismatch — ignoring (possible spoofed request)", { order_id });
      return res.status(200).send("OK");
    }

    const order = await Order.findById(order_id);

    if (!order) {
      console.warn("PayHere notify: order not found", order_id);
      return res.status(200).send("OK");
    }

    const paymentStatusMap = {
      2: "Paid",
      0: "Pending",
      "-1": "Cancelled",
      "-2": "Failed",
      "-3": "Chargedback",
    };

    order.paymentStatus = paymentStatusMap[String(status_code)] || "Pending";
    order.payhere = {
      paymentId: payment_id,
      method,
      statusCode: status_code,
    };

    // Only bump the fulfillment `status` field on a confirmed successful
    // payment — never on failure/cancel, so we don't clobber other
    // meanings of that field (e.g. "cancelled" used elsewhere for
    // fulfillment cancellation, "fulfilled" set by your admin/POS flow).
    if (order.paymentStatus === "Paid") {
      order.status = "paid";
    }

    // Payment failed/was cancelled/charged back — give the stock back
    // (checkoutOrder already deducted it when the order was created) and
    // mark the order cancelled, but only once even if PayHere retries.
    const isDeadEnd = ["Failed", "Cancelled", "Chargedback"].includes(order.paymentStatus);

    if (isDeadEnd && order.paymentMethod === "CARD" && !order.stockRestored) {
      await restoreStock(order);
      order.stockRestored = true;
      order.status = "cancelled";
    }

    await order.save();

    return res.status(200).send("OK");
  } catch (error) {
    console.error("PayHere notify error:", error);
    // Still respond 200 — a 500 here makes PayHere retry repeatedly.
    return res.status(200).send("OK");
  }
};

// =========================================================
// GET /api/payments/payhere/status/:orderId
// Frontend polls this after payhere.onCompleted() fires — that callback
// fires for BOTH successful and failed payments, so the real status only
// exists once the notify_url callback above has landed and saved it.
// =========================================================
export const getPaymentStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).select("paymentStatus status total");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.json({ paymentStatus: order.paymentStatus, status: order.status, total: order.total });
  } catch (error) {
    console.error("PayHere status check error:", error);
    return res.status(500).json({ message: "Failed to check payment status" });
  }
};
