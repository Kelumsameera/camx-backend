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
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    // ✅ shippingOptions එක main object එක ඇතුළට ගෙනාවා
    shippingOptions: {
      priceMatch: { type: Boolean, default: true },
      protectionPlan: { type: Boolean, default: true },
      protectionFeePercentage: { type: Number, default: 0.06 }, // 6%
      freeDelivery: { type: Boolean, default: true },
      deliveryDaysMin: { type: Number, default: 3 },
      deliveryDaysMax: { type: Number, default: 6 },
      pickupAvailable: { type: Boolean, default: true },
      pickupTime: { type: String, default: "24h at our Colombo showroom" },
    },
  },
  {
    timestamps: true, // මේක තමයි Schema එකේ දෙවෙනි parameter එක
  },
);

productSchema.index({ category: 1, isAvailable: 1 });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);
export default Product;
