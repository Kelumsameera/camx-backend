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
import { requireAdmin } from "../middleware/auth.js";
import { reviewLimiter } from "../middleware/rateLimiter.js";

const reviewRouter = express.Router();

// =====================================
// PRODUCT REVIEW ROUTES (PUBLIC READ)
// =====================================

reviewRouter.get("/product/:productId", getAllReviews);
reviewRouter.get("/rating/:productId", getProductRating);

// =====================================
// USER REVIEW ROUTES
// =====================================

reviewRouter.post("/", reviewLimiter, createReview);
reviewRouter.patch("/vote/:reviewId", reviewLimiter, voteReview);
reviewRouter.put("/:reviewId", reviewLimiter, updateReview);
reviewRouter.delete("/:reviewId", reviewLimiter, deleteReview);

// =====================================
// ADMIN REVIEW ROUTES
// =====================================

reviewRouter.get("/admin/all", requireAdmin, adminGetAllReviews);
reviewRouter.put("/admin/:reviewId", requireAdmin, adminUpdateReview);
reviewRouter.delete("/admin/:reviewId", requireAdmin, adminDeleteReview);
reviewRouter.patch("/admin/restore/:reviewId", requireAdmin, adminRestoreReview);

// =====================================
// SINGLE REVIEW ROUTE
// =====================================

reviewRouter.get("/:reviewId", getReviewById);

export default reviewRouter;
