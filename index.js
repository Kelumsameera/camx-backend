import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";

// MIDDLEWARE & UTILITIES
import { authenticate } from "./middleware/auth.js";
import { generalLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import logger from "./utils/logger.js";

// ROUTES
import userRouter from "./routes/userRouter.js";
import productRouter from "./routes/productRouter.js";
import orderRouter from "./routes/orderRouter.js";
import reviewRouter from "./routes/reviewRouter.js";
import analyticsRouter from "./routes/analyticsRoutes.js";
import contactRouter from "./routes/contactRouter.js";
import categoryRouter from "./routes/categoryRouter.js";
import paymentRoutes from "./routes/paymentRoutes.js";

dotenv.config();

const app = express();

// =========================
// SECURITY HEADERS (CAMX-020)
// =========================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// =========================
// CORS CONFIGURATION (CAMX-020)
// =========================
const defaultAllowedOrigins = ["http://localhost:3000", "https://camxfrontend.vercel.app", "https://camx.lk", "https://admin.camx.lk", "https://www.camx.lk"];

const envAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()) : [];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman, or server-to-server webhooks like PayHere)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id"],
  }),
);

// =========================
// BODY PARSERS & RESOURCE LIMITS (CAMX-007, CAMX-024)
// =========================
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));

// =========================
// GENERAL RATE LIMITING (CAMX-021)
// =========================
app.use(generalLimiter);

// =========================
// AUTHENTICATION MIDDLEWARE
// =========================
app.use(authenticate);

// =========================
// DATABASE CONNECTION
// =========================
const isRunningTests = process.env.NODE_ENV === "test" || process.env.NODE_ENV === "testing" || process.execArgv.includes("--test") || process.argv.some((a) => a.includes("test"));

if (!isRunningTests && process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      logger.info("Connected to MongoDB successfully");
    })
    .catch((error) => {
      logger.error("MongoDB Connection Error", error);
    });
}

// =========================
// API ROUTES
// =========================

app.use("/api/users", userRouter);
app.use("/api/products", productRouter);
app.use("/api/orders", orderRouter);
app.use("/api/reviews", reviewRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/contacts", contactRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/payments", paymentRoutes);

// Health check / root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CAMX.lk Backend Running 🚀",
  });
});

// =========================
// 404 HANDLER
// =========================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// =========================
// CENTRALIZED ERROR HANDLER
// =========================
app.use(errorHandler);

// =========================
// SERVER START
// =========================
const port = process.env.PORT || 5000;

if (!isRunningTests) {
  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
}

export default app;
