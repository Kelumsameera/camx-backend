import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import userRouter from "./routes/userRouter.js";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();

// Database Connection
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("Connected to DB");
    })
    .catch((error) => {
        console.log("DB Connection Error:", error);
    });

app.use(express.json());

// Auth Middleware
app.use((req, res, next) => {
    const authorizationHeader = req.header("Authorization");

    if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
        const token = authorizationHeader.replace("Bearer ", "");

        // token verify
        jwt.verify(token, process.env.SECRET_KEY, (error, content) => {
            if (error) {
                // Token invalid or expired
                return res.status(401).json({
                    message: "Invalid or expired token",
                });
            } else {
                // Token valid, content contains the payload
                req.user = content;
                next();
            }
        });
    } else {
        // Token not provided
        next();
    }
});

app.use("/users", userRouter);

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});