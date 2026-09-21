import mongoose from "mongoose";
import crypto from "crypto";
import Review from "../models/review.js";
import ReviewVote from "../models/ReviewVote.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { isAdmin } from "../middleware/auth.js";
import { sanitizeHtml, sanitizeText } from "../utils/xssSanitizer.js";
import { parsePagination } from "../middleware/validate.js";
import logger from "../utils/logger.js";

// Check review ownership (must be logged in and user IDs match)
function isOwner(review, req) {
  if (!req.user || !review.userId) return false;
  return review.userId.toString() === (req.user._id || req.user.id).toString();
}

// ==============================
// CREATE REVIEW (CAMX-017, CAMX-019)
// ==============================
export async function createReview(req, res) {
  try {
    const { productId, name, rating, title, comment, images } = req.body;

    if (!productId || !rating || !title || !comment) {
      return res.status(400).json({
        success: false,
        message: "Missing required review fields (productId, rating, title, comment)",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be an integer between 1 and 5",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const userId = req.user ? req.user._id : null;

    // Prevent duplicate reviews for logged-in users
    if (userId) {
      const existingReview = await Review.findOne({
        productId,
        userId,
        deleted: false,
      });

      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: "You have already reviewed this product",
        });
      }
    }

    // Authoritatively determine verified purchase by checking paid orders (CAMX-017)
    let isVerifiedPurchase = false;
    if (req.user && req.user.email) {
      const paidOrder = await Order.findOne({
        userEmail: req.user.email.toLowerCase(),
        "items.productId": product.productId,
        status: { $in: ["paid", "COMPLETED", "fulfilled"] },
      });
      if (paidOrder) {
        isVerifiedPurchase = true;
      }
    }

    // XSS Sanitization (CAMX-019)
    const sanitizedTitle = sanitizeText(title);
    const sanitizedComment = sanitizeHtml(comment);
    const sanitizedName = sanitizeText(name || req.user?.firstName || "Anonymous");

    const review = new Review({
      productId,
      userId,
      name: sanitizedName,
      rating: numericRating,
      title: sanitizedTitle,
      comment: sanitizedComment,
      verified: isVerifiedPurchase, // Calculated server-side, client parameter ignored
      images: Array.isArray(images) ? images.filter((img) => typeof img === "string") : [],
    });

    const saved = await review.save();
    logger.info("Review created", { reviewId: saved._id, productId, verified: isVerifiedPurchase });

    return res.status(201).json({
      success: true,
      message: "Review created successfully",
      review: saved,
    });
  } catch (err) {
    logger.error("Error creating review", err);
    return res.status(500).json({
      success: false,
      message: "Error creating review",
    });
  }
}

// ==============================
// GET ALL REVIEWS FOR PRODUCT (PAGINATED)
// ==============================
export async function getAllReviews(req, res) {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const { page, limit, skip } = parsePagination(req, 10, 50);
    const sort = req.query.sort || "latest";

    let sortOption = { createdAt: -1 };
    if (sort === "highest") sortOption = { rating: -1 };
    else if (sort === "lowest") sortOption = { rating: 1 };
    else if (sort === "helpful") sortOption = { helpful: -1 };

    const filter = {
      productId,
      hidden: false,
      deleted: false,
      status: "approved",
    };

    const reviews = await Review.find(filter).populate("userId", "firstName lastName image").sort(sortOption).skip(skip).limit(limit);

    const totalReviews = await Review.countDocuments(filter);

    return res.status(200).json({
      success: true,
      totalReviews,
      currentPage: page,
      totalPages: Math.ceil(totalReviews / limit),
      reviews,
    });
  } catch (err) {
    logger.error("Error fetching reviews", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching reviews",
    });
  }
}

// ==============================
// GET REVIEW BY ID
// ==============================
export async function getReviewById(req, res) {
  try {
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    const review = await Review.findById(reviewId).populate("userId", "firstName lastName").populate("productId", "name productId");

    if (!review || review.deleted) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    return res.status(200).json({ success: true, review });
  } catch (err) {
    logger.error("Error fetching review", err);
    return res.status(500).json({ success: false, message: "Error fetching review" });
  }
}

// ==============================
// VOTE REVIEW (CAMX-018)
// ==============================
export async function voteReview(req, res) {
  try {
    const { reviewId } = req.params;
    const { type } = req.body;

    if (!["helpful", "notHelpful"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vote type. Must be 'helpful' or 'notHelpful'.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    const review = await Review.findById(reviewId);
    if (!review || review.deleted) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // Determine voter identifier: User ID if logged in, or hashed IP/agent if guest
    const userId = req.user ? req.user._id : null;
    const clientIdentifier = req.ip || req.connection.remoteAddress || "anonymous";
    const voterIdentifier = crypto
      .createHash("sha256")
      .update(clientIdentifier + (req.headers["user-agent"] || ""))
      .digest("hex");

    // Check duplicate vote using ReviewVote collection
    try {
      const vote = new ReviewVote({
        reviewId,
        userId,
        voterIdentifier,
        voteType: type,
      });
      await vote.save();
    } catch (duplicateErr) {
      if (duplicateErr.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "You have already voted on this review.",
        });
      }
      throw duplicateErr;
    }

    // Atomic increment
    const updatedReview = await Review.findByIdAndUpdate(reviewId, { $inc: { [type]: 1 } }, { returnDocument: "after" });

    return res.status(200).json({
      success: true,
      message: "Vote recorded successfully",
      review: updatedReview,
    });
  } catch (err) {
    logger.error("Error recording vote", err);
    return res.status(500).json({
      success: false,
      message: "Error recording vote",
    });
  }
}

// ==============================
// UPDATE REVIEW (CAMX-016)
// ==============================
export async function updateReview(req, res) {
  try {
    const { reviewId } = req.params;
    const { title, comment, rating, images } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    const review = await Review.findById(reviewId);
    if (!review || review.deleted) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // GUEST REVIEWS CANNOT BE MODIFIED / ONLY AUTHENTICATED OWNER OR ADMIN (CAMX-016)
    if (!isAdmin(req) && (!review.userId || !isOwner(review, req))) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not authorized to update this review",
      });
    }

    if (title !== undefined) review.title = sanitizeText(title);
    if (comment !== undefined) review.comment = sanitizeHtml(comment);
    if (rating !== undefined) {
      const numRating = Number(rating);
      if (numRating >= 1 && numRating <= 5) review.rating = numRating;
    }
    if (Array.isArray(images)) {
      review.images = images.filter((img) => typeof img === "string");
    }

    await review.save();

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      review,
    });
  } catch (err) {
    logger.error("Error updating review", err);
    return res.status(500).json({
      success: false,
      message: "Error updating review",
    });
  }
}

// ==============================
// DELETE REVIEW (CAMX-016)
// ==============================
export async function deleteReview(req, res) {
  try {
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }

    const review = await Review.findById(reviewId);
    if (!review || review.deleted) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    // GUEST REVIEWS CANNOT BE DELETED BY PUBLIC / ONLY AUTHENTICATED OWNER OR ADMIN (CAMX-016)
    if (!isAdmin(req) && (!review.userId || !isOwner(review, req))) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not authorized to delete this review",
      });
    }

    review.deleted = true;
    await review.save();

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (err) {
    logger.error("Error deleting review", err);
    return res.status(500).json({
      success: false,
      message: "Error deleting review",
    });
  }
}

// ==============================
// ADMIN GET ALL REVIEWS (CAMX-013, CAMX-025)
// ==============================
export async function adminGetAllReviews(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  try {
    const { page, limit, skip } = parsePagination(req, 20, 100);

    const reviews = await Review.find().populate("userId", "firstName lastName email").populate("productId", "name productId").sort({ createdAt: -1 }).skip(skip).limit(limit);

    const total = await Review.countDocuments();

    return res.status(200).json({
      success: true,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      reviews,
    });
  } catch (err) {
    logger.error("Error fetching admin reviews", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching admin reviews",
    });
  }
}

// ==============================
// ADMIN UPDATE REVIEW
// ==============================
export async function adminUpdateReview(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  try {
    const { reviewId } = req.params;
    const { title, comment, rating, hidden, deleted, status, adminReply } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    if (title !== undefined) review.title = sanitizeText(title);
    if (comment !== undefined) review.comment = sanitizeHtml(comment);
    if (rating !== undefined) review.rating = Number(rating);
    if (hidden !== undefined) review.hidden = Boolean(hidden);
    if (deleted !== undefined) review.deleted = Boolean(deleted);
    if (status !== undefined && ["pending", "approved", "rejected"].includes(status)) {
      review.status = status;
    }
    if (adminReply !== undefined) review.adminReply = sanitizeHtml(adminReply);

    await review.save();

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
      review,
    });
  } catch (err) {
    logger.error("Error updating review by admin", err);
    return res.status(500).json({
      success: false,
      message: "Error updating review",
    });
  }
}

// ==============================
// ADMIN DELETE REVIEW
// ==============================
export async function adminDeleteReview(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  try {
    const { reviewId } = req.params;
    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    review.deleted = true;
    await review.save();

    return res.status(200).json({
      success: true,
      message: "Review soft-deleted successfully",
      review,
    });
  } catch (err) {
    logger.error("Error deleting review by admin", err);
    return res.status(500).json({
      success: false,
      message: "Error deleting review",
    });
  }
}

// ==============================
// ADMIN RESTORE REVIEW
// ==============================
export async function adminRestoreReview(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  try {
    const { reviewId } = req.params;
    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }

    review.deleted = false;
    await review.save();

    return res.status(200).json({
      success: true,
      message: "Review restored successfully",
      review,
    });
  } catch (err) {
    logger.error("Error restoring review by admin", err);
    return res.status(500).json({
      success: false,
      message: "Error restoring review",
    });
  }
}

// ==============================
// GET PRODUCT RATING SUMMARY
// ==============================
export async function getProductRating(req, res) {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const result = await Review.aggregate([
      {
        $match: {
          productId: new mongoose.Types.ObjectId(productId),
          hidden: false,
          deleted: false,
          status: "approved",
        },
      },
      {
        $group: {
          _id: "$productId",
          averageRating: { $avg: "$rating" },
          reviewCount: { $sum: 1 },
          helpfulCount: { $sum: "$helpful" },
        },
      },
    ]);

    if (result.length === 0) {
      return res.status(200).json({
        success: true,
        averageRating: 0,
        reviewCount: 0,
        helpfulCount: 0,
      });
    }

    return res.status(200).json({
      success: true,
      averageRating: Number(result[0].averageRating.toFixed(1)),
      reviewCount: result[0].reviewCount,
      helpfulCount: result[0].helpfulCount,
    });
  } catch (error) {
    logger.error("Failed to get rating summary", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get rating",
    });
  }
}
