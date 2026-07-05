import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import cors from "cors";

// ROUTES
import userRouter from "./routes/userRouter.js";
import productRouter from "./routes/productRouter.js";
import orderRouter from "./routes/orderRouter.js";
import reviewRouter from "./routes/reviewRouter.js";
import analyticsRouter from "./routes/analyticsRoutes.js";
import contactRouter from "./routes/contactRouter.js";
import categoryRouter from "./routes/categoryRouter.js";

dotenv.config();

const app = express();

// =========================
// DATABASE CONNECTION
// =========================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((error) => {
    console.log("❌ MongoDB Connection Error:", error);
  });

// =========================
// MIDDLEWARE
// =========================

// JSON PARSER
app.use(express.json());

// CORS
app.use(
  cors({
    origin: "*",
    credentials: true,
  }),
);

// =========================
// AUTH MIDDLEWARE
// =========================

app.use((req, res, next) => {
  const authorizationHeader = req.header("Authorization");

  if (authorizationHeader && authorizationHeader.startsWith("Bearer ")) {
    const token = authorizationHeader.replace("Bearer ", "");

    jwt.verify(
      token,
      process.env.SECRET_KEY,

      (error, content) => {
        if (error) {
          return res.status(401).json({
            message: "Invalid or expired token",
          });
        } else {
          req.user = content;

          next();
        }
      },
    );
  } else {
    next();
  }
});

// =========================
// API ROUTES
// =========================

// USERS
app.use("/api/users", userRouter);

// PRODUCTS
app.use("/api/products", productRouter);

// ORDERS
app.use("/api/orders", orderRouter);

// REVIEWS
app.use("/api/reviews", reviewRouter);

app.use("/api/analytics", analyticsRouter);

app.use("/api/contacts", contactRouter);

app.use("/api/categories", categoryRouter);
// =========================
// TEST ROUTE
// =========================

app.get("/", (req, res) => {
  res.json({
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
    message: "Route not found",
  });
});

// =========================
// SERVER
// =========================

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
