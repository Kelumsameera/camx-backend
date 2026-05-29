import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    altName: {
      type: [String],
      default: [],
    },

    description: {
      type: String,
      required: true,
    },

    // SPECIFICATIONS
    specifications: {
      type: Map,
      of: String,
      default: {},
    },

    price: {
      type: Number,
      required: true,
    },

    labelPrice: {
      type: Number,
      required: true,
    },

    images: {
      type: [String],
      required: true,
    },

    // MAIN CATEGORY
    category: {
      type: String,
      required: true,
    },

    // SUB CATEGORIES (අලුතින් එකතු කළ කොටස)
    subcategories: {
      type: [String],
      default: [],
    },

    brand: {
      type: String,
      required: true,
      default: "No Brand",
    },

    stock: {
      type: Number,
      required: true,
      default: 0,
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const Product = mongoose.model("Product", productSchema);

export default Product;
