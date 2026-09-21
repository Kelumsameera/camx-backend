import { test, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../index.js";
import User from "../models/User.js";

describe("Authentication & User Security Tests", () => {
  test("User registration rejects invalid email and short passwords", async () => {
    const invalidEmailRes = await request(app).post("/api/users").send({
      email: "not-an-email",
      firstName: "John",
      lastName: "Doe",
      password: "password123",
    });
    assert.equal(invalidEmailRes.status, 400);

    const shortPassRes = await request(app).post("/api/users").send({
      email: "valid@example.com",
      firstName: "John",
      lastName: "Doe",
      password: "123",
    });
    assert.equal(shortPassRes.status, 400);
  });

  test("User login fails on invalid password with 401", async () => {
    const originalFindOne = User.findOne;
    const hashedPassword = await bcrypt.hash("correct_password", 10);

    User.findOne = () => ({
      select: () =>
        Promise.resolve({
          _id: "507f1f77bcf86cd799439011",
          email: "user@example.com",
          password: hashedPassword,
          isBlocked: false,
          role: "customer",
        }),
    });

    try {
      const res = await request(app).post("/api/users/login").send({
        email: "user@example.com",
        password: "wrong_password",
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.message, "Invalid password");
    } finally {
      User.findOne = originalFindOne;
    }
  });

  test("Blocked user login fails with 403", async () => {
    const originalFindOne = User.findOne;
    const hashedPassword = await bcrypt.hash("password123", 10);

    User.findOne = () => ({
      select: () =>
        Promise.resolve({
          _id: "507f1f77bcf86cd799439011",
          email: "blocked@example.com",
          password: hashedPassword,
          isBlocked: true, // Blocked user
          role: "customer",
        }),
    });

    try {
      const res = await request(app).post("/api/users/login").send({
        email: "blocked@example.com",
        password: "password123",
      });

      assert.equal(res.status, 403);
      assert.ok(res.body.message.includes("blocked"));
    } finally {
      User.findOne = originalFindOne;
    }
  });
});
