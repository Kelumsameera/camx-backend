import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import userRouter from "./routes/userRouter.js";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("Connected to DB");
    })
    .catch((error) => {
        console.log(error);
    });
app.use(express.json());

app.use(
    (req, res, next) => {

        const Authorizationheaders = req.header("Authorization");
        if (Authorizationheaders != null) {
            const token = Authorizationheaders.replace("Bearer ", "");
            console.log(token);

            jwt.verify(token, "secretKey96$2025",
                (error, content) => {
                    
                    if (content == null){
                        console.log("Invalid token");



                    }else {
                        console.log(content);

                    }

                }
            )



        }
      


        next();

    }
);

app.use("/users", userRouter);

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
