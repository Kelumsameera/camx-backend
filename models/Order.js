import mongoose from "mongoose";

// ======================================
// ORDER ITEM SCHEMA
// ======================================

const orderItemSchema = new mongoose.Schema(
  {
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
  },
  { _id: false },
);

// ======================================
// ORDER SCHEMA
// ======================================

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Idempotency Key to prevent duplicate checkouts
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },

    // USER (Online Orders)
    userEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
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
      enum: ["COD", "BankTransfer", "CASH", "CARD", "ONLINE"],
      default: "COD",
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Cancelled", "Chargedback"],
      default: "Pending",
      index: true,
    },

    // PayHere gateway metadata
    payhere: {
      paymentId: { type: String, default: null },
      method: { type: String, default: null },
      statusCode: { type: String, default: null },
    },

    stockRestored: {
      type: Boolean,
      default: false,
    },

    // Authoritative financial totals
    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    shipping: {
      type: Number,
      required: true,
      min: 0,
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
      validate: [(val) => val.length > 0, "Order must contain at least one item."],
    },

    // STATUS
    status: {
      type: String,
      enum: ["pending", "paid", "fulfilled", "cancelled", "COMPLETED"],
      default: "pending",
      index: true,
    },

    // POS FIELDS
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
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for fast lookup and dashboard analytics
orderSchema.index({ userEmail: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;
