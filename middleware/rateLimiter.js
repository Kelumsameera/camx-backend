import rateLimit from "express-rate-limit";

const isTest = process.env.NODE_ENV === "test";

// Generic helper to create rate limiters
function createLimiter(windowMs, max, message) {
  if (isTest) {
    // Pass-through in test environment
    return (req, res, next) => next();
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: message || "Too many requests. Please try again later.",
    },
  });
}

// Strict rate limiter for Authentication (Login, Register, OTP, Google Auth)
export const authLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  15, // max 15 requests per IP
  "Too many authentication attempts. Please try again after 15 minutes.",
);

// Rate limiter for Checkout and Payments
export const checkoutLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  30, // max 30 requests per IP
  "Too many checkout attempts. Please try again in a few minutes.",
);

// Rate limiter for Reviews and Review Voting
export const reviewLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  60, // max 60 actions per IP
  "Too many review actions. Please slow down.",
);

// Rate limiter for Contact Form
export const contactLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  20, // max 20 messages per IP
  "Too many contact submissions. Please try again later.",
);

// General API rate limiter
export const generalLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  600, // max 600 requests per IP
  "Too many requests to the server. Please try again later.",
);

export default {
  authLimiter,
  checkoutLimiter,
  reviewLimiter,
  contactLimiter,
  generalLimiter,
};
