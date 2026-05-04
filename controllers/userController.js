import User from "../models/users.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"; 

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
  user.save().then(() => {
    res.json({
      message: "User created successfully",
    });
  });
}

export function loginUsers(req, res) {
  const email = req.body.email;
  const password = req.body.password;

  User.find({ email: email }).then((users) => {
    if (users[0] == null) {
      res.json({
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

        const token = jwt.sign(payload, "secretKey96$2025")

        res.json({
          message: "Login successful",
            token: token,
        });
      } else {
        res.json({
          message: "Incorrect password",
        });
      }
    }
  });
}
