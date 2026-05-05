import User from "../models/users.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"; 
import dotenv from "dotenv";
dotenv.config();

export function createUser(req, res) {
  const data = req.body;
  const hashedPassword = bcrypt.hashSync(data.password, 10);

  const user = new User({
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    password: hashedPassword,
    role: data.role,
  });

  user.save().then(
    () => {
      res.status(201).json({
        message: "User created successfully",
      });
    },
    (error) => {
      res.status(500).json({ 
        message: "Error creating user", 
        error: error.message 
      });
    }
  );
}

export function loginUsers(req, res) {
  const email = req.body.email;
  const password = req.body.password;

  
  User.find({ email: email }).then(
    (users) => {
      if (users[0] == null) {
        res.status(404).json({
          message: "User not found",
        });
      } else {
        const user = users[0];
        const isPasswordCorrect = bcrypt.compareSync(password, user.password);

        if (isPasswordCorrect) {
          const payload = {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            image: user.image,
          };

          const token = jwt.sign(payload, process.env.SECRET_KEY,{
            expiresIn: "24h"
          });

          res.status(200).json({
            message: "Login successful",
            token: token,
          });
        } else {
          res.status(401).json({
            message: "Incorrect password",
          });
        }
      }
    },
    (error) => {
      res.status(500).json({ 
        message: "An error occurred", 
        error: error.message 
      });
    }
  );
}
export function isAdmin(req){
    if (req.user == null) {
        
        return false;
    }
    if (req.user.role !== "admin") {
        
        return false;
    }
    return true;
}