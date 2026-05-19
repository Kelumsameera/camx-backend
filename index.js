import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import cors from "cors";

import userRouter from "./routes/userRouter.js";
import productRouter from "./routes/productRouter.js";
import orderRouter from "./routes/orderRouter.js";

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
    console.log(
      "❌ MongoDB Connection Error:",
      error
    );
  });


// =========================
// MIDDLEWARE
// =========================

// JSON Parser
app.use(express.json());


// CORS FIX
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);


// =========================
// AUTH MIDDLEWARE
// =========================

app.use((req, res, next) => {

  const authorizationHeader =
    req.header("Authorization");

  if (
    authorizationHeader != null &&
    authorizationHeader.startsWith(
      "Bearer "
    )
  ) {

    const token =
      authorizationHeader.replace(
        "Bearer ",
        ""
      );

    jwt.verify(
      token,
      process.env.SECRET_KEY,

      (error, content) => {

        if (error) {

          return res.status(401).json({
            message:
              "Invalid or expired token",
          });

        } else {

          req.user = content;

          next();
        }
      }
    );

  } else {

    next();
  }
});


// =========================
// ROUTES
// =========================

app.use("/users", userRouter);

app.use("/products", productRouter);

app.use("/orders", orderRouter);


// =========================
// TEST ROUTE
// =========================

app.get("/", (req, res) => {
  res.json({
    message:
      "CAMX.lk Backend Running 🚀",
  });
});


// =========================
// SERVER
// =========================

const port =
  Number(process.env.PORT) || 5000;

app.listen(port, () => {

  console.log(
    `🚀 Server running on port ${port}`
  );
});