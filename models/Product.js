import mongoose from "mongoose";

// ✅ shippingOptions වෙනම sub-schema එකක් විදිහට define කළා.
// වැදගත්ම දේ: subfields වලට default value දාලා නෑ.
// (කලින් "default: true" වගේ දේවල් දාලා තිබ්බ නිසා, admin
// data නොදුන්නත් Mongoose auto-fill කළා — ඒකයි හැම product එකකටම
// shipping options පෙනුනේ)
const shippingOptionsSchema = new mongoose.Schema(
  {
    priceMatch: { type: Boolean },
    protectionPlan: { type: Boolean },
    protectionFeePercentage: { type: Number },
    freeDelivery: { type: Boolean },
    deliveryDaysMin: { type: Number },
    deliveryDaysMax: { type: Number },
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
    // ✅ shippingOptions එකට "default: undefined" දාලා තියෙනවා.
    // admin data නොදුන්නොත් මේ field එකම document එකේ save වෙන්නේ නෑ
    // (undefined ලෙසම පවතී), auto-fill වෙන්නෙත් නෑ.
    shippingOptions: {
      type: shippingOptionsSchema,
      default: undefined,
    },
  },
  {
    timestamps: true, // මේක තමයි Schema එකේ දෙවෙනි parameter එක
  },
);

productSchema.index({ category: 1, isAvailable: 1 });

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);
export default Product;
