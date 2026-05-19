import User from "../models/Users.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios"; // REQUIRED FOR GOOGLE LOGIN
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import Otp from "../models/otp.js";
dotenv.config();

const transporter = nodemailer.createTransport({
	service: "gmail",
	host: "smtp.gmail.com",
	port: 587,
	secure: false,
	auth: {
		user: process.env.EMAIL,
		pass: process.env.GMAIL_APP_PASSWORD,
	},
});


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


export function loginUser(req, res) {
  const email = req.body.email;
  const password = req.body.password;

  User.find({ email: email }).then((users) => {
    if (users[0] == null) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = users[0];

    if (user.isBlocked) {
      return res.status(403).json({
        message: "User is blocked. Contact admin.",
      });
    }

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

      // FIXED: Changed JWT_SECRET to SECRET_KEY to match your .env file
      const token = jwt.sign(payload, process.env.SECRET_KEY, {
        expiresIn: "150h",
      });

      return res.json({
        message: "Login successful",
        token: token,
        role: user.role,
      });
    } else {
      return res.status(401).json({
        message: "Invalid password",
      });
    }
  });
}


export function isAdmin(req) {
  if (!req.user) return false;
  if (req.user.role !== "admin") return false;
  return true;
}

//Get user profile
export function getUser(req, res) {
  if (!req.user) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  console.log(req.user);
  res.json(req.user);
}

//Google Login
export async function googleLogin(req, res) {
  console.log("Google Token:", req.body.token);

  try {
    // Get Google profile
    const response = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${req.body.token}` },
      }
    );

    const googleData = response.data;
    console.log("Google User:", googleData);

    let user = await User.findOne({ email: googleData.email });

    // If user doesn't exist
    if (!user) {
      const newUser = new User({
        email: googleData.email,
        firstName: googleData.given_name,
        lastName: googleData.family_name,
        password: bcrypt.hashSync("google-auth", 10), // safer password
        role: "user",
        image: googleData.picture,
        isEmailVerified: true,
      });

      user = await newUser.save();
    }

    // If user is blocked
    if (user.isBlocked) {
      return res.status(403).json({
        message: "User is blocked. Contact admin.",
      });
    }

    // JWT Payload
    const payload = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: true,
      image: user.image,
    };

    // FIXED: Changed JWT_SECRET to SECRET_KEY to match your .env file
    const token = jwt.sign(payload, process.env.SECRET_KEY, {
      expiresIn: "150h",
    });

    return res.json({
      message: "Login successful",
      token: token,
      role: user.role,
    });
  } catch (error) {
    console.error("Google Login Error:", error);

    return res.status(500).json({
      message: "Google login failed",
      error: error.message,
    });
  }
}
export async function sendOtp(req, res) {
	try {
	const email = req.params.email;
	const user = await User.findOne({ email: email });
	if (user == null) {
		res.status(404).json({ message: "User not found" });
		return ;
	}
	await Otp.deleteMany({
		 email: email 
		});

	// generate random 6-digit OTP
	 const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
	const newOtp = new Otp({
		email: email,
		otp: otpCode,
	});
	await newOtp.save();
	const message ={
		from: process.env.EMAIL,
		to: email,
		subject: "Your OTP Code",
		text: `Your OTP code is: ${otpCode}` // In real application, generate a random OTP
	};
	transporter.sendMail(message, (err, info) => {
		if (err) {
			console.error("Error sending email:", err);
			res.status(500).json({ message: "Failed to send OTP" });
		} else {
			console.log("Email sent:", info.response);
			res.json({ message: "OTP sent successfully" });
		}
	});
	} catch (error) {
		console.error("Error in sendOtp:", error);
		res.status(500).json({ message: "Internal server error" });
	}
  // Implementation for sending OTP
}
export async function validateOTPAndUpdatePassword(req, res) {
	try {
		const email = req.body.email;
		const otp = req.body.otp;
		const newPassword = req.body.newPassword;

		const otpRecord = await Otp.findOne({ email: email, otp: otp });
		if (otpRecord == null) {
			res.status(400).json({ message: "Invalid OTP" });
			return ;
		}
		const hashedPassword = bcrypt.hashSync(newPassword, 10);
		await User.updateOne(
			{ email: email },
			{ $set: { password: hashedPassword , isEmailVerified: true } }
		);
		await Otp.deleteMany({ email: email });
		res.json({ message: "Password updated successfully" });
	} catch (error) {
		console.error("Error in validateOTPAndUpdatePassword:", error);
		res.status(500).json({ message: "Internal server error" });
	} 
}

export async function getAllUsers(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      message: "Access denied",
    });
  }
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching users",
      error: error.message,
    });
  }
}

export async function updateUserStatus(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      message: "Access denied",
    });
  }

  const email = req.params.email; // FIXED
  const isBlocked = req.body.isBlocked;

  // Prevent admin from blocking themselves
  if (req.user.email === email) {
    return res.status(400).json({
      message: "Admin cannot block/unblock themselves",
    });
  }

  try {
    await User.updateOne(
      { email: email },
      { $set: { isBlocked: isBlocked } }
    );

    res.json({
      message: "User status updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating user status",
      error: error.message,
    });
  }
}
