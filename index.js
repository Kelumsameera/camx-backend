import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import userRouter from "./routes/userRouter.js";

dotenv.config();

const app = express();

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
      console.log('Connected to DB'); 
  })
    .catch((error) => {
        console.log(error);
    });
  app.use(express.json());
  app.use("/users",userRouter);


  
  app.listen(3000, () => {
          console.log('Server is running on port 3000');
      });