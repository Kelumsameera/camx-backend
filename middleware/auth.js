import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import logger from "../utils/logger.js";

// Helper to check admin status
export function isAdmin(req) {
  return Boolean(req.user && req.user.role === "admin" && !req.user.isBlocked);
}

// Universal authentication middleware
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return next();
    }

    const secretKey = process.env.SECRET_KEY;
    if (!secretKey) {
      logger.error("SECRET_KEY environment variable is not defined");
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    jwt.verify(token, secretKey, async (err, decoded) => {
      if (err) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token",
        });
      }

      let dbUser = null;
      // When connected to database, verify active status and ensure user is not blocked
      if (mongoose.connection.readyState === 1) {
        dbUser = await User.findOne({ email: decoded.email }).select("-password");
        if (!dbUser) {
          return res.status(401).json({
            success: false,
            message: "User account not found",
          });
        }

        if (dbUser.isBlocked) {
          return res.status(403).json({
            success: false,
            message: "Account is blocked. Contact admin.",
          });
        }
      }

      req.user = {
        _id: dbUser?._id || decoded.id || decoded._id,
        id: dbUser?._id || decoded.id || decoded._id,
        email: dbUser?.email || decoded.email,
        firstName: dbUser?.firstName || decoded.firstName,
        lastName: dbUser?.lastName || decoded.lastName,
        role: dbUser?.role || decoded.role || "customer",
        isEmailVerified: dbUser?.isEmailVerified ?? decoded.isEmailVerified ?? true,
        isBlocked: dbUser?.isBlocked ?? false,
        image: dbUser?.image || decoded.image || "default-profile-picture.jpg",
      };

      next();
    });
  } catch (error) {
    logger.error("Authentication middleware error", error);
    return res.status(500).json({ success: false, message: "Authentication failure" });
  }
}

// Require authenticated user
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Authentication required",
    });
  }
  if (req.user.isBlocked) {
    return res.status(403).json({
      success: false,
      message: "Account is blocked. Contact admin.",
    });
  }
  next();
}

// Require admin user
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Authentication required",
    });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Admin privileges required",
    });
  }
  if (req.user.isBlocked) {
    return res.status(403).json({
      success: false,
      message: "Account is blocked. Contact admin.",
    });
  }
  next();
}

export default { authenticate, requireAuth, requireAdmin, isAdmin };
