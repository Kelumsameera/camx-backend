import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    // PRODUCT REFERENCE
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // USER REFERENCE
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // REVIEWER NAME
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    // STAR RATING
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    // REVIEW TITLE
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },

    // REVIEW COMMENT
    comment: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 2000,
    },

    // REVIEW IMAGES
    images: {
      type: [String],
      default: [],
    },

    // VERIFIED PURCHASE
    verified: {
      type: Boolean,
      default: false,
    },

    // HELPFUL COUNTS
    helpful: {
      type: Number,
      default: 0,
    },

    notHelpful: {
      type: Number,
      default: 0,
    },

    // ADMIN REPLY
    adminReply: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    // REVIEW STATUS
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },

    // HIDE REVIEW
    hidden: {
      type: Boolean,
      default: false,
    },

    // SOFT DELETE
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

/* =========================
   INDEXES
========================= */

// FAST PRODUCT REVIEW FETCHING
reviewSchema.index({ productId: 1 });

// FAST USER REVIEW FETCHING
reviewSchema.index({ userId: 1 });

// SORT BY LATEST
reviewSchema.index({ createdAt: -1 });

// PREVENT DUPLICATE REVIEWS
reviewSchema.index(
  { productId: 1, userId: 1 },
  { unique: true }
);

/* =========================
   EXPORT
========================= */

export default mongoose.model("Review", reviewSchema);