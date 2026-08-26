import mongoose from "mongoose";

// ======================================
// ORDER ITEM SCHEMA
// ======================================

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  image: {
    type: String,
    default: "",
  },
});

// ======================================
// ORDER SCHEMA
// ======================================

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },

    // USER (Online Orders)
    userEmail: {
      type: String,
      default: null,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    district: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
      default: "",
    },

    paymentMethod: {
      type: String,
      // POS එකෙන් එන CASH, CARD සහ ONLINE මෙතැනට එකතු කළා
      enum: ["COD", "BankTransfer", "CASH", "CARD", "ONLINE"],
      default: "COD",
    },

    // PayHere (or any future gateway) payment confirmation status —
    // kept SEPARATE from `status` below so PayHere's async notify callback
    // never overwrites fulfillment states like "fulfilled"/"cancelled".
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Cancelled", "Chargedback"],
      default: "Pending",
    },

    // PayHere gateway metadata, set once the notify_url callback lands.
    payhere: {
      paymentId: { type: String, default: null },
      method: { type: String, default: null },
      statusCode: { type: String, default: null },
    },

    // checkoutOrder() deducts product stock at order-creation time, even
    // for CARD orders that haven't been paid yet. If the payment then
    // fails/is cancelled, the notify handler restores that stock — this
    // flag stops it from being restored twice if PayHere retries the callback.
    stockRestored: {
      type: Boolean,
      default: false,
    },

    // PRICES
    subtotal: {
      type: Number,
      default: 0,
    },
    shipping: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },

    // ORDER ITEMS
    items: {
      type: [orderItemSchema],
      required: true,
    },

    // STATUS
    status: {
      type: String,
      // POS එකෙන් එන COMPLETED මෙතැනට එකතු කළා
      enum: ["pending", "paid", "fulfilled", "cancelled", "COMPLETED"],
      default: "paid",
    },

    // ==========================================
    // ADVANCED POS FIELDS
    // ==========================================
    customerName: {
      type: String,
      default: "Walk-in Customer",
    },
    customerPhone: {
      type: String,
      default: "",
    },
    discountGiven: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
