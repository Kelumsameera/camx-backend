import mongoose from "mongoose";

const reviewVoteSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Review",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    voterIdentifier: {
      type: String,
      required: true,
      index: true,
    },
    voteType: {
      type: String,
      enum: ["helpful", "notHelpful"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate votes per authenticated user on the same review
reviewVoteSchema.index(
  { reviewId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { userId: { $exists: true, $ne: null } },
  },
);

// Prevent duplicate votes per guest voter identifier (IP / fingerprint hash) on the same review
reviewVoteSchema.index({ reviewId: 1, voterIdentifier: 1 }, { unique: true });

const ReviewVote = mongoose.models.ReviewVote || mongoose.model("ReviewVote", reviewVoteSchema);
export default ReviewVote;
