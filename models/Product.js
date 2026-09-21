import mongoose from "mongoose";

const shippingOptionsSchema = new mongoose.Schema(
  {
    priceMatch: { type: Boolean },
    protectionPlan: { type: Boolean },
    protectionFeePercentage: { type: Number, min: 0 },
    freeDelivery: { type: Boolean },
    deliveryDaysMin: { type: Number, min: 0 },
    deliveryDaysMax: { type: Number, min: 0 },
    pickupAvailable: { type: Boolean },
    pickupTime: { type: String },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    altName: {
      type: [String],
      default: [],
    },
    description: {
      type: String,
      required: true,
    },
    specifications: {
      type: Map,
      of: String,
      default: {},
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price must be non-negative"],
    },
    labelPrice: {
      type: Number,
      required: true,
      min: [0, "Label price must be non-negative"],
    },
    images: {
      type: [String],
      required: true,
      validate: [(arr) => arr.length > 0, "At least one product image is required."],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
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
      min: [0, "Stock cannot be negative"],
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    shippingOptions: {
      type: shippingOptionsSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

productSchema.index({ category: 1, isAvailable: 1, createdAt: -1 });
productSchema.index({ isAvailable: 1, stock: 1 });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);
export default Product;
