import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    // Self-reference to parent category. null => root category.
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    // Depth in the tree. 0 = root. Kept denormalized for fast reads/sorts,
    // recomputed automatically on create/update in the controller.
    level: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Display order among siblings.
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Prevent duplicate category names under the same parent
// (works correctly for multiple roots too, since (null, "A") !== (null, "B")).
categorySchema.index({ parent: 1, name: 1 }, { unique: true });

// Speeds up "get children of X sorted by order" queries.
categorySchema.index({ parent: 1, order: 1 });

const Category = mongoose.model("Category", categorySchema);

export default Category;
