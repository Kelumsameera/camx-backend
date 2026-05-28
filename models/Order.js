import mongoose from "mongoose";

// ======================================
// ORDER ITEM SCHEMA
// ======================================

const orderItemSchema =
  new mongoose.Schema({

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

const orderSchema =
  new mongoose.Schema(

    {
      orderId: {
        type: String,
        required: true,
        unique: true,
      },

      // USER
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
        enum: [
          "COD",
          "BankTransfer",
        ],
        default: "COD",
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
        enum: [
          "pending",
          "paid",
          "fulfilled",
          "cancelled",
        ],
        default: "paid",
      },
    },

    {
      timestamps: true,
    }
  );

const Order =
  mongoose.model(
    "Order",
    orderSchema
  );

export default Order;