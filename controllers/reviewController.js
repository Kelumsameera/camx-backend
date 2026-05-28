import mongoose from "mongoose";
import Review from "../models/Review.js";

// ==============================
// HELPER FUNCTIONS
// ==============================

function isAdmin(req) {
  return req.user?.role === "admin";
}

function isOwner(review, req) {
  return review.userId.toString() === req.user?._id?.toString();
}

// ==============================
// CREATE REVIEW
// ==============================

export async function createReview(req, res) {
  try {
    const {
      productId,
      userId,
      name,
      rating,
      title,
      comment,
      verified,
      images,
    } = req.body;

    // VALIDATION
    if (
      !productId ||
      !userId ||
      !rating ||
      !title ||
      !comment
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // VALID OBJECT IDS
    if (
      !mongoose.Types.ObjectId.isValid(productId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product or user ID",
      });
    }

    // RATING VALIDATION
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    // PREVENT DUPLICATE REVIEWS
    const existingReview = await Review.findOne({
      productId,
      userId,
      deleted: false,
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You already reviewed this product",
      });
    }

    // CREATE REVIEW
    const review = new Review({
      productId,
      userId,
      name: name || "Anonymous",
      rating,
      title,
      comment,
      verified: verified ?? false,
      images: Array.isArray(images) ? images : [],
    });

    const saved = await review.save();

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      review: saved,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error creating review",
      error: err.message,
    });
  }
}

// ==============================
// GET ALL REVIEWS FOR PRODUCT
// ==============================

export async function getAllReviews(req, res) {
  try {
    const { productId } = req.params;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const sort = req.query.sort || "latest";

    let sortOption = {};

    switch (sort) {
      case "highest":
        sortOption = { rating: -1 };
        break;

      case "lowest":
        sortOption = { rating: 1 };
        break;

      case "helpful":
        sortOption = { helpful: -1 };
        break;

      default:
        sortOption = { createdAt: -1 };
    }

    const reviews = await Review.find({
      productId,
      hidden: false,
      deleted: false,
      status: "approved",
    })
      .populate("userId", "name")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit);

    const totalReviews = await Review.countDocuments({
      productId,
      hidden: false,
      deleted: false,
      status: "approved",
    });

    res.json({
      success: true,
      totalReviews,
      currentPage: page,
      totalPages: Math.ceil(totalReviews / limit),
      reviews,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching reviews",
      error: err.message,
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
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    const review = await Review.findById(reviewId)
      .populate("userId", "name")
      .populate("productId", "name");

    if (!review || review.deleted) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    res.json({
      success: true,
      review,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching review",
      error: err.message,
    });
  }
}

// ==============================
// VOTE REVIEW
// ==============================

export async function voteReview(req, res) {
  try {
    const { reviewId } = req.params;
    const { type } = req.body;

    if (!["helpful", "notHelpful"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vote type",
      });
    }

    const review = await Review.findById(reviewId);

    if (!review || review.deleted) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (type === "helpful") {
      review.helpful += 1;
    } else {
      review.notHelpful += 1;
    }

    await review.save();

    res.json({
      success: true,
      message: "Vote recorded successfully",
      review,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error recording vote",
      error: err.message,
    });
  }
}

// ==============================
// UPDATE USER REVIEW
// ==============================

export async function updateReview(req, res) {
  try {
    const { reviewId } = req.params;
    const { title, comment, rating, images } = req.body;

    const review = await Review.findById(reviewId);

    if (!review || review.deleted) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // OWNER CHECK
    if (!isOwner(review, req)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (rating !== undefined) review.rating = rating;

    if (images !== undefined) {
      review.images = Array.isArray(images) ? images : [];
    }

    await review.save();

    res.json({
      success: true,
      message: "Review updated successfully",
      review,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error updating review",
      error: err.message,
    });
  }
}

// ==============================
// DELETE USER REVIEW
// ==============================

export async function deleteReview(req, res) {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);

    if (!review || review.deleted) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // OWNER CHECK
    if (!isOwner(review, req)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    review.deleted = true;

    await review.save();

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error deleting review",
      error: err.message,
    });
  }
}

// ==============================
// ADMIN GET ALL REVIEWS
// ==============================

export async function adminGetAllReviews(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const reviews = await Review.find()
      .populate("userId", "name")
      .populate("productId", "name")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      reviews,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching admin reviews",
      error: err.message,
    });
  }
}

// ==============================
// ADMIN UPDATE REVIEW
// ==============================

export async function adminUpdateReview(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const { reviewId } = req.params;

    const {
      title,
      comment,
      rating,
      hidden,
      deleted,
      status,
      adminReply,
    } = req.body;

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (rating !== undefined) review.rating = rating;
    if (hidden !== undefined) review.hidden = hidden;
    if (deleted !== undefined) review.deleted = deleted;
    if (status !== undefined) review.status = status;
    if (adminReply !== undefined) review.adminReply = adminReply;

    await review.save();

    res.json({
      success: true,
      message: "Review updated successfully",
      review,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error updating review",
      error: err.message,
    });
  }
}

// ==============================
// ADMIN DELETE REVIEW
// ==============================

export async function adminDeleteReview(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    review.deleted = true;

    await review.save();

    res.json({
      success: true,
      message: "Review soft-deleted successfully",
      review,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error deleting review",
      error: err.message,
    });
  }
}

// ==============================
// ADMIN RESTORE REVIEW
// ==============================

export async function adminRestoreReview(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    review.deleted = false;

    await review.save();

    res.json({
      success: true,
      message: "Review restored successfully",
      review,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error restoring review",
      error: err.message,
    });
  }
}

// ==============================
// GET PRODUCT RATING SUMMARY
// ==============================

export async function getProductRating(req, res) {
  try {
    const { productId } = req.params;

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
          averageRating: {
            $avg: "$rating",
          },
          reviewCount: {
            $sum: 1,
          },
          helpfulCount: {
            $sum: "$helpful",
          },
        },
      },
    ]);

    if (result.length === 0) {
      return res.json({
        success: true,
        averageRating: 0,
        reviewCount: 0,
        helpfulCount: 0,
      });
    }

    res.json({
      success: true,
      averageRating: Number(
        result[0].averageRating.toFixed(1)
      ),
      reviewCount: result[0].reviewCount,
      helpfulCount: result[0].helpfulCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get rating",
      error: error.message,
    });
  }
}