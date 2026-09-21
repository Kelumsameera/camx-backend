import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    // PRODUCT REFERENCE
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    // USER REFERENCE (OPTIONAL FOR GUEST REVIEWS)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
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
      minlength: 2,
      maxlength: 150,
    },

    // REVIEW COMMENT
    comment: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 3000,
    },

    // REVIEW IMAGES
    images: {
      type: [String],
      default: [],
    },

    // VERIFIED PURCHASE (determined authoritatively server-side)
    verified: {
      type: Boolean,
      default: false,
    },

    // HELPFUL COUNTS
    helpful: {
      type: Number,
      default: 0,
      min: 0,
    },

    notHelpful: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ADMIN REPLY
    adminReply: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1500,
    },

    // REVIEW STATUS
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },

    // HIDE REVIEW
    hidden: {
      type: Boolean,
      default: false,
      index: true,
    },

    // SOFT DELETE
    deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

/* =========================
   INDEXES
========================= */

reviewSchema.index({ productId: 1, status: 1, hidden: 1, deleted: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });

// Prevent duplicate reviews for authenticated users
reviewSchema.index(
  {
    productId: 1,
    userId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      userId: {
        $exists: true,
        $ne: null,
      },
      deleted: false,
    },
  },
);

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
export default Review;
