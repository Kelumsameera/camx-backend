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
    // CATEGORY (Tree Reference)
    // A product is always saved against the LOWEST (leaf) category the user
    // picked in the cascading selector. Parent categories are derived on
    // demand via GET /api/categories/:id/path (breadcrumb).
    // The old `category: String` + `subcategories: [String]` fields have been
    // removed — see scripts/migrateCategories.js for the migration path.
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
  },
  {
    timestamps: true,
  },
);

// Common query pattern: list available products in a given category.
productSchema.index({ category: 1, isAvailable: 1 });

const Product = mongoose.model("Product", productSchema);
export default Product;
