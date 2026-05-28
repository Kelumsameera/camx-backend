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
  adminDeleteReview,
  adminRestoreReview,
  getProductRating,
} from "../controllers/reviewController.js";

const reviewRouter = express.Router();

// =====================================
// PRODUCT REVIEW ROUTES
// =====================================

// Get all reviews for a product
reviewRouter.get("/product/:productId", getAllReviews);

// Product rating summary
reviewRouter.get("/rating/:productId", getProductRating);

// =====================================
// USER REVIEW ROUTES
// =====================================

// Create review
reviewRouter.post("/", createReview);

// Vote helpful / not helpful
reviewRouter.patch("/vote/:reviewId", voteReview);

// Update own review
reviewRouter.put("/:reviewId", updateReview);

// Delete own review
reviewRouter.delete("/:reviewId", deleteReview);

// =====================================
// ADMIN REVIEW ROUTES
// =====================================

// Get all reviews
reviewRouter.get("/admin/all", adminGetAllReviews);

// Admin update review
reviewRouter.put("/admin/:reviewId", adminUpdateReview);

// Soft delete review
reviewRouter.delete("/admin/:reviewId", adminDeleteReview);

// Restore deleted review
reviewRouter.patch(
  "/admin/restore/:reviewId",
  adminRestoreReview
);

// =====================================
// SINGLE REVIEW ROUTE
// =====================================

// Get single review
reviewRouter.get("/:reviewId", getReviewById);

export default reviewRouter;