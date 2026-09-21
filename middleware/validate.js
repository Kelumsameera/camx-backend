import mongoose from "mongoose";

// Validate Mongo ObjectId in params
export function validateObjectId(paramName = "id") {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ID provided for ${paramName}`,
      });
    }
    next();
  };
}

// Parse and constrain pagination parameters safely
export function parsePagination(req, defaultLimit = 10, maxLimit = 100) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const rawLimit = parseInt(req.query.limit, 10) || defaultLimit;
  const limit = Math.max(1, Math.min(rawLimit, maxLimit));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

// Email format validator
export function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export default {
  validateObjectId,
  parsePagination,
  isValidEmail,
};
