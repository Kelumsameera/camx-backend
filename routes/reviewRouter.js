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

// GET ALL REVIEWS FOR PRODUCT
reviewRouter.get("/product/:productId", getAllReviews);

// PRODUCT RATING SUMMARY
reviewRouter.get("/rating/:productId", getProductRating);

// =====================================
// USER REVIEW ROUTES
// =====================================

// CREATE REVIEW
reviewRouter.post("/", createReview);

// VOTE HELPFUL / NOT HELPFUL
reviewRouter.patch("/vote/:reviewId", voteReview);

// UPDATE REVIEW
reviewRouter.put("/:reviewId", updateReview);

// DELETE REVIEW
reviewRouter.delete("/:reviewId", deleteReview);

// =====================================
// ADMIN REVIEW ROUTES
// =====================================

// GET ALL REVIEWS
reviewRouter.get("/admin/all", adminGetAllReviews);

// ADMIN UPDATE REVIEW
reviewRouter.put("/admin/:reviewId", adminUpdateReview);

// ADMIN SOFT DELETE REVIEW
reviewRouter.delete("/admin/:reviewId", adminDeleteReview);

// ADMIN RESTORE REVIEW
reviewRouter.patch("/admin/restore/:reviewId", adminRestoreReview);

// =====================================
// SINGLE REVIEW ROUTE
// =====================================

// GET SINGLE REVIEW
reviewRouter.get("/:reviewId", getReviewById);

export default reviewRouter;
