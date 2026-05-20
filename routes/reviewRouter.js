import express from "express";

import {
  createReview,
  getAllReviews,
  getReviewById,
  voteReview,
  updateReview,
  deleteReview,
  adminGetAllReviews,
  adminUpdateReview,
  adminToggleHidden,
  adminDeleteReview,
  adminRestoreReview,
  getProductRating,
} from "../controllers/reviewController.js";

const reviewRouter = express.Router();

// =====================================
// USER ROUTES
// =====================================

// Create Review
reviewRouter.post("/", createReview);

// Get all reviews for a product
reviewRouter.get("/product/:productId", getAllReviews);

// Get single review
reviewRouter.get("/:reviewId", getReviewById);

// Vote helpful / not helpful
reviewRouter.patch("/vote/:reviewId", voteReview);

// Update own review
reviewRouter.put("/:reviewId", updateReview);

// Delete own review
reviewRouter.delete("/:reviewId", deleteReview);

// Product rating summary
reviewRouter.get("/rating/:productId", getProductRating);

// =====================================
// ADMIN ROUTES
// =====================================

// Get all reviews
reviewRouter.get("/admin/all", adminGetAllReviews);

// Admin update review
reviewRouter.put("/admin/:reviewId", adminUpdateReview);

// Hide / Unhide review
reviewRouter.patch("/admin/hide/:reviewId", adminToggleHidden);

// Soft delete review
reviewRouter.delete("/admin/:reviewId", adminDeleteReview);

// Restore deleted review
reviewRouter.patch("/admin/restore/:reviewId", adminRestoreReview);

export default reviewRouter;