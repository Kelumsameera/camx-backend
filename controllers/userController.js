import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import Otp from "../models/otp.js";
import logger from "../utils/logger.js";
import { isValidEmail, parsePagination } from "../middleware/validate.js";
import { isAdmin } from "../middleware/auth.js";

dotenv.config();

// Export isAdmin for controller backwards-compatibility
export { isAdmin };

// =========================
// EMAIL TRANSPORTER
// =========================
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

// =========================
// REGISTER / CREATE USER (CAMX-001)
// =========================
export async function createUser(req, res) {
  try {
    const { email, firstName, lastName, password } = req.body;

    // Validate required fields
    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({
        success: false,
        message: "Email, first name, last name, and password are required.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing user
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A user with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // SECURITY: Force role to 'customer'. Ignore any client-supplied role, isAdmin, or permissions
    const user = new User({
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      password: hashedPassword,
      role: "customer", // Strict default role (CAMX-001)
      isBlocked: false,
      isEmailVerified: false,
    });

    await user.save();

    logger.info("New user registered successfully", { email: normalizedEmail });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
    });
  } catch (error) {
    logger.error("Error creating user", error);
    return res.status(500).json({
      success: false,
      message: "Error creating user",
    });
  }
}

// =========================
// LOGIN USER (CAMX-011, CAMX-012)
// =========================
export async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Must explicitly select password because select: false is on schema
    const user = await User.findOne({ email: normalizedEmail }).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isBlocked) {
      logger.security("Blocked user login attempt", { email: normalizedEmail });
      return res.status(403).json({
        success: false,
        message: "User is blocked. Contact admin.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      logger.security("Invalid password login attempt", { email: normalizedEmail });
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    const payload = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      image: user.image,
    };

    // Use 24-hour token lifetime for security
    const token = jwt.sign(payload, process.env.SECRET_KEY, {
      expiresIn: "24h",
    });

    logger.info("User logged in successfully", { email: normalizedEmail, role: user.role });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      role: user.role,
    });
  } catch (error) {
    logger.error("Login error", error);
    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
}

// =========================
// GET USER PROFILE
// =========================
export function getUser(req, res) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  return res.status(200).json(req.user);
}

// =========================
// GOOGLE LOGIN (CAMX-012)
// =========================
export async function googleLogin(req, res) {
  try {
    const { token: googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({
        success: false,
        message: "Google token is required",
      });
    }

    // Get Google profile
    const response = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${googleToken}` },
    });

    const googleData = response.data;
    if (!googleData || !googleData.email) {
      return res.status(400).json({
        success: false,
        message: "Invalid Google user data",
      });
    }

    const normalizedEmail = googleData.email.trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });

    // If user doesn't exist, create customer
    if (!user) {
      const randomPassword = `google-auth-${Date.now()}-${Math.random()}`;
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = new User({
        email: normalizedEmail,
        firstName: googleData.given_name || "Google",
        lastName: googleData.family_name || "User",
        password: hashedPassword,
        role: "customer", // Strict default role
        image: googleData.picture || "default-profile-picture.jpg",
        isEmailVerified: true,
      });

      await user.save();
    }

    if (user.isBlocked) {
      logger.security("Blocked user Google login attempt", { email: normalizedEmail });
      return res.status(403).json({
        success: false,
        message: "User is blocked. Contact admin.",
      });
    }

    const payload = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: true,
      image: user.image,
    };

    const token = jwt.sign(payload, process.env.SECRET_KEY, {
      expiresIn: "24h",
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      role: user.role,
    });
  } catch (error) {
    logger.error("Google Login Error", error);
    return res.status(500).json({
      success: false,
      message: "Google login failed",
    });
  }
}

// =========================
// SEND OTP
// =========================
export async function sendOtp(req, res) {
  try {
    const email = req.params.email?.trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: "Invalid email address" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Clear existing OTPs for this email
    await Otp.deleteMany({ email });

    // Generate random 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newOtp = new Otp({
      email,
      otp: otpCode,
    });
    await newOtp.save();

    const message = {
      from: process.env.EMAIL,
      to: email,
      subject: "Your CAMX OTP Code",
      text: `Your OTP verification code is: ${otpCode}. This code will expire in 10 minutes.`,
    };

    transporter.sendMail(message, (err, info) => {
      if (err) {
        logger.error("Error sending OTP email", err);
        return res.status(500).json({ success: false, message: "Failed to send OTP" });
      }
      logger.info("OTP email sent successfully", { email });
      return res.status(200).json({ success: true, message: "OTP sent successfully" });
    });
  } catch (error) {
    logger.error("Error in sendOtp", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

// =========================
// VALIDATE OTP & UPDATE PASSWORD
// =========================
export async function validateOTPAndUpdatePassword(req, res) {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: "Email, OTP, and new password are required." });
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters long." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const otpRecord = await Otp.findOne({ email: normalizedEmail, otp: otp.trim() });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ email: normalizedEmail }, { $set: { password: hashedPassword, isEmailVerified: true } });

    await Otp.deleteMany({ email: normalizedEmail });

    logger.info("Password reset successful", { email: normalizedEmail });

    return res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    logger.error("Error in validateOTPAndUpdatePassword", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

// =========================
// GET ALL USERS (ADMIN) (CAMX-011, CAMX-025)
// =========================
export async function getAllUsers(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const { page, limit, skip } = parsePagination(req, 20, 100);

    // Password hashes are automatically excluded via select: false on schema
    const users = await User.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    const totalUsers = await User.countDocuments();

    return res.status(200).json(users);
  } catch (error) {
    logger.error("Error fetching users", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching users",
    });
  }
}

// =========================
// UPDATE USER STATUS (ADMIN) (CAMX-014)
// =========================
export async function updateUserStatus(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  const email = req.params.email?.trim().toLowerCase();
  const { isBlocked } = req.body;

  if (isBlocked === undefined) {
    return res.status(400).json({
      success: false,
      message: "isBlocked boolean value is required",
    });
  }

  // Prevent admin from blocking themselves
  if (req.user.email?.toLowerCase() === email) {
    return res.status(400).json({
      success: false,
      message: "Admin cannot block/unblock themselves",
    });
  }

  try {
    const result = await User.updateOne({ email }, { $set: { isBlocked: Boolean(isBlocked) } });

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    logger.security("User block status updated by admin", { targetEmail: email, isBlocked });

    return res.status(200).json({
      success: true,
      message: "User status updated successfully",
    });
  } catch (error) {
    logger.error("Error updating user status", error);
    return res.status(500).json({
      success: false,
      message: "Error updating user status",
    });
  }
}
