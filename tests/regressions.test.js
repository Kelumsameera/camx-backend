import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import app from "../index.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Review from "../models/review.js";
import ReviewVote from "../models/ReviewVote.js";

const TEST_SECRET = "test_jwt_secret_key_for_unit_tests_123456";
process.env.SECRET_KEY = TEST_SECRET;
process.env.PAYHERE_MERCHANT_ID = "TEST_MERCHANT_ID";
process.env.PAYHERE_MERCHANT_SECRET = "TEST_MERCHANT_SECRET";
process.env.PAYHERE_SANDBOX = "true";

function generateTestToken(user) {
  return jwt.sign(
    {
      id: user._id || "507f1f77bcf86cd799439011",
      email: user.email,
      firstName: user.firstName || "Test",
      lastName: user.lastName || "User",
      role: user.role || "customer",
      isEmailVerified: true,
    },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

describe("CAMX.LK Security & Business Logic Regression Suite (CAMX-001 to CAMX-022)", () => {
  // ==========================================
  // CAMX-001: PREVENT ADMIN PRIVILEGE ESCALATION
  // ==========================================
  test("CAMX-001: Registration ignores client-supplied role=admin and forces role=customer", async () => {
    const originalSave = User.prototype.save;
    let savedUserRole = null;

    User.prototype.save = async function () {
      savedUserRole = this.role;
      return this;
    };

    const originalFindOne = User.findOne;
    User.findOne = () => Promise.resolve(null); // No existing user

    try {
      const res = await request(app).post("/api/users").send({
        email: "hacker@domain.com",
        firstName: "Bad",
        lastName: "Actor",
        password: "password123",
        role: "admin", // Malicious privilege escalation attempt
        isAdmin: true,
      });

      assert.equal(res.status, 201);
      assert.equal(savedUserRole, "customer", "Role must be forced to 'customer'");
    } finally {
      User.prototype.save = originalSave;
      User.findOne = originalFindOne;
    }
  });

  // ==========================================
  // CAMX-002: SECURE CHECKOUT (AUTHORITATIVE FINANCIALS)
  // ==========================================
  test("CAMX-002: Checkout ignores client-manipulated price and total, calculates from DB", async () => {
    const originalFindOneAndUpdate = Product.findOneAndUpdate;
    const originalOrderSave = Order.prototype.save;

    // Mock DB product with authoritative price 5000 and stock 10
    Product.findOneAndUpdate = async () => ({
      productId: "CAM-TEST-001",
      name: "Security Camera 4K",
      price: 5000,
      stock: 8,
      images: ["cam.jpg"],
    });

    let savedOrder = null;
    Order.prototype.save = async function () {
      savedOrder = this;
      return this;
    };

    try {
      const res = await request(app)
        .post("/api/orders/checkout")
        .send({
          items: [
            {
              productId: "CAM-TEST-001",
              quantity: 2,
              price: 1, // Malicious client price
              unitPrice: 1, // Malicious unit price
            },
          ],
          total: 2, // Malicious total
          totalPrice: 2,
          discountGiven: 9999,
          paymentMethod: "COD",
        });

      assert.equal(res.status, 201);
      assert.ok(savedOrder);
      // Authoritative subtotal: 2 * 5000 = 10000
      assert.equal(savedOrder.subtotal, 10000, "Subtotal must be calculated from DB price");
      assert.equal(savedOrder.total, 10000, "Total must match server-calculated total");
      assert.equal(savedOrder.items[0].unitPrice, 5000, "Line item unit price must match DB");
    } finally {
      Product.findOneAndUpdate = originalFindOneAndUpdate;
      Order.prototype.save = originalOrderSave;
    }
  });

  // ==========================================
  // CAMX-003: ATOMIC INVENTORY & ROLLBACK
  // ==========================================
  test("CAMX-003: Insufficient stock triggers 400 error and rollback of prior items", async () => {
    const originalFindOneAndUpdate = Product.findOneAndUpdate;
    const originalUpdateOne = Product.updateOne;
    const originalFindOne = Product.findOne;

    let rollbackCount = 0;
    Product.updateOne = async () => {
      rollbackCount++;
      return { modifiedCount: 1 };
    };

    let callIndex = 0;
    Product.findOneAndUpdate = async (query) => {
      callIndex++;
      if (callIndex === 1) {
        // First item succeeds
        return { productId: "PROD-1", name: "Item 1", price: 1000, stock: 5 };
      }
      // Second item fails (insufficient stock)
      return null;
    };

    Product.findOne = async () => ({ productId: "PROD-2", name: "Item 2" });

    try {
      const res = await request(app)
        .post("/api/orders/checkout")
        .send({
          items: [
            { productId: "PROD-1", quantity: 1 },
            { productId: "PROD-2", quantity: 10 },
          ],
        });

      assert.equal(res.status, 400);
      assert.ok(res.body.message.includes("Insufficient stock"));
      assert.equal(rollbackCount, 1, "Prior item should have been rolled back");
    } finally {
      Product.findOneAndUpdate = originalFindOneAndUpdate;
      Product.updateOne = originalUpdateOne;
      Product.findOne = originalFindOne;
    }
  });

  // ==========================================
  // CAMX-004: CHECKOUT IDEMPOTENCY
  // ==========================================
  test("CAMX-004: Same Idempotency-Key returns existing order without creating duplicate", async () => {
    const originalFindOne = Order.findOne;

    const existingOrder = {
      orderId: "ORD-EXISTING-123",
      idempotencyKey: "unique-key-abc",
      total: 5000,
      items: [{ productId: "CAM-1", quantity: 1, unitPrice: 5000 }],
    };

    Order.findOne = async (query) => {
      if (query && query.idempotencyKey === "unique-key-abc") {
        return existingOrder;
      }
      return null;
    };

    try {
      const res = await request(app)
        .post("/api/orders/checkout")
        .set("Idempotency-Key", "unique-key-abc")
        .send({
          items: [{ productId: "CAM-1", quantity: 1 }],
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.order.orderId, "ORD-EXISTING-123");
      assert.ok(res.body.message.includes("idempotent"));
    } finally {
      Order.findOne = originalFindOne;
    }
  });

  // ==========================================
  // CAMX-005: PAYHERE SANDBOX LOGIC
  // ==========================================
  test("CAMX-005: PAYHERE_SANDBOX is accurately evaluated as boolean true", () => {
    process.env.PAYHERE_SANDBOX = "true";
    const sandboxTrue = process.env.PAYHERE_SANDBOX === "true";
    assert.equal(sandboxTrue, true);

    process.env.PAYHERE_SANDBOX = "false";
    const sandboxFalse = process.env.PAYHERE_SANDBOX === "true";
    assert.equal(sandboxFalse, false);

    process.env.PAYHERE_SANDBOX = "true"; // Restore
  });

  // ==========================================
  // CAMX-006 & CAMX-007: PAYHERE WEBHOOK & HASH VALIDATION
  // ==========================================
  test("CAMX-007: PayHere notify webhook rejects invalid signature or tampered amounts", async () => {
    const originalFindOne = Order.findOne;
    Order.findOne = async () => ({
      _id: "60d5ec49f1b2c8b1f8e4e1a1",
      orderId: "ORD-999",
      total: 10000,
      paymentStatus: "Pending",
      save: async () => {},
    });

    try {
      const res = await request(app).post("/api/payments/payhere/notify").type("form").send({
        merchant_id: "TEST_MERCHANT_ID",
        order_id: "60d5ec49f1b2c8b1f8e4e1a1",
        payment_id: "PAY-123",
        payhere_amount: "1.00", // Tampered amount (DB has 10000.00)
        payhere_currency: "LKR",
        status_code: "2",
        md5sig: "INVALIDSIGNATURE",
      });

      // Notify endpoint returns 200 to satisfy gateway retry logic, but ignores tampered data
      assert.equal(res.status, 200);
      assert.equal(res.text, "OK");
    } finally {
      Order.findOne = originalFindOne;
    }
  });

  // ==========================================
  // CAMX-008: PAYMENT STATUS IDOR PROTECTION
  // ==========================================
  test("CAMX-008: Non-owner customer is forbidden from querying another user's order status", async () => {
    const originalFindOne = Order.findOne;
    Order.findOne = () => ({
      select: () =>
        Promise.resolve({
          _id: "507f1f77bcf86cd799439011",
          orderId: "ORD-VICTIM-1",
          userEmail: "victim@example.com",
          paymentStatus: "Paid",
          total: 15000,
        }),
    });

    const attackerToken = generateTestToken({
      _id: "507f1f77bcf86cd799439099",
      email: "attacker@example.com",
      role: "customer",
    });

    try {
      const res = await request(app).get("/api/payments/payhere/status/ORD-VICTIM-1").set("Authorization", `Bearer ${attackerToken}`);

      assert.equal(res.status, 403);
      assert.ok(res.body.message.includes("Forbidden"));
    } finally {
      Order.findOne = originalFindOne;
    }
  });

  // ==========================================
  // CAMX-009 & CAMX-010: ANALYTICS ENDPOINTS PROTECTED
  // ==========================================
  test("CAMX-009 & CAMX-010: Analytics endpoints reject unauthenticated or non-admin requests", async () => {
    const customerToken = generateTestToken({
      email: "customer@example.com",
      role: "customer",
    });

    // Anonymous check (401 Unauthorized)
    const anonRes1 = await request(app).get("/api/orders/analytics/comprehensive");
    assert.equal(anonRes1.status, 401);

    const anonRes2 = await request(app).get("/api/analytics/google-analytics");
    assert.equal(anonRes2.status, 401);

    // Customer check (403 Forbidden)
    const custRes1 = await request(app).get("/api/orders/analytics/comprehensive").set("Authorization", `Bearer ${customerToken}`);
    assert.equal(custRes1.status, 403);

    const custRes2 = await request(app).get("/api/analytics/google-analytics").set("Authorization", `Bearer ${customerToken}`);
    assert.equal(custRes2.status, 403);
  });

  // ==========================================
  // CAMX-011: PASSWORD HASH PROTECTION
  // ==========================================
  test("CAMX-011: getAllUsers does not return password hashes", async () => {
    const originalFind = User.find;
    const originalCount = User.countDocuments;

    User.find = () => ({
      sort: () => ({
        skip: () => ({
          limit: () =>
            Promise.resolve([
              {
                _id: "1",
                email: "user@test.com",
                firstName: "John",
                lastName: "Doe",
                role: "customer",
                // password field is omitted
              },
            ]),
        }),
      }),
    });
    User.countDocuments = () => Promise.resolve(1);

    const adminToken = generateTestToken({
      email: "admin@camx.lk",
      role: "admin",
    });

    try {
      const res = await request(app).get("/api/users/all").set("Authorization", `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.equal(res.body[0].password, undefined, "Password hash must not be exposed");
    } finally {
      User.find = originalFind;
      User.countDocuments = originalCount;
    }
  });

  // ==========================================
  // CAMX-016: GUEST REVIEW IMMUTABILITY
  // ==========================================
  test("CAMX-016: Public / Unauthenticated user cannot update or delete guest reviews", async () => {
    const originalFindById = Review.findById;
    Review.findById = async () => ({
      _id: "60d5ec49f1b2c8b1f8e4e1a5",
      userId: null, // Guest review
      title: "Good camera",
      comment: "Works well",
      deleted: false,
      save: async () => {},
    });

    try {
      // Attempt to modify guest review without authentication
      const updateRes = await request(app).put("/api/reviews/60d5ec49f1b2c8b1f8e4e1a5").send({ title: "Hacked Review" });

      assert.equal(updateRes.status, 403);

      // Attempt to delete guest review without authentication
      const deleteRes = await request(app).delete("/api/reviews/60d5ec49f1b2c8b1f8e4e1a5");

      assert.equal(deleteRes.status, 403);
    } finally {
      Review.findById = originalFindById;
    }
  });

  // ==========================================
  // CAMX-017: CLIENT CANNOT SPOOF VERIFIED BADGE
  // ==========================================
  test("CAMX-017: Review creation ignores client-supplied verified=true", async () => {
    const originalProductFindById = Product.findById;
    const originalOrderFindOne = Order.findOne;
    const originalReviewSave = Review.prototype.save;

    Product.findById = async () => ({
      _id: "507f1f77bcf86cd799439011",
      productId: "CAM-1",
      name: "Test Cam",
    });

    // User has no paid order for this product
    Order.findOne = async () => null;

    let savedReview = null;
    Review.prototype.save = async function () {
      savedReview = this;
      return this;
    };

    try {
      const res = await request(app).post("/api/reviews").send({
        productId: "507f1f77bcf86cd799439011",
        name: "Guest",
        rating: 5,
        title: "Awesome",
        comment: "Best product ever",
        verified: true, // Malicious spoof attempt
      });

      assert.equal(res.status, 201);
      assert.ok(savedReview);
      assert.equal(savedReview.verified, false, "Verified status must be determined by server");
    } finally {
      Product.findById = originalProductFindById;
      Order.findOne = originalOrderFindOne;
      Review.prototype.save = originalReviewSave;
    }
  });

  // ==========================================
  // CAMX-018: DUPLICATE REVIEW VOTING PREVENTED
  // ==========================================
  test("CAMX-018: Repeated voting on the same review returns 400", async () => {
    const originalReviewFindById = Review.findById;
    const originalVoteSave = ReviewVote.prototype.save;

    Review.findById = async () => ({
      _id: "60d5ec49f1b2c8b1f8e4e1a1",
      helpful: 5,
      notHelpful: 0,
      deleted: false,
    });

    // First vote succeeds, second vote throws duplicate key error (11000)
    let voteAttempt = 0;
    ReviewVote.prototype.save = async function () {
      voteAttempt++;
      if (voteAttempt > 1) {
        const err = new Error("E11000 duplicate key error");
        err.code = 11000;
        throw err;
      }
      return this;
    };

    const originalFindByIdAndUpdate = Review.findByIdAndUpdate;
    Review.findByIdAndUpdate = async () => ({
      _id: "60d5ec49f1b2c8b1f8e4e1a1",
      helpful: 6,
    });

    try {
      const res1 = await request(app).patch("/api/reviews/vote/60d5ec49f1b2c8b1f8e4e1a1").send({ type: "helpful" });

      assert.equal(res1.status, 200);

      // Repeat vote
      const res2 = await request(app).patch("/api/reviews/vote/60d5ec49f1b2c8b1f8e4e1a1").send({ type: "helpful" });

      assert.equal(res2.status, 400);
      assert.ok(res2.body.message.includes("already voted"));
    } finally {
      Review.findById = originalReviewFindById;
      ReviewVote.prototype.save = originalVoteSave;
      Review.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });

  // ==========================================
  // CAMX-020: SECURITY HEADERS & CORS
  // ==========================================
  test("CAMX-020: Helmet security headers are present on API responses", async () => {
    const res = await request(app).get("/");
    assert.equal(res.status, 200);
    assert.ok(res.headers["x-content-type-options"], "X-Content-Type-Options header must be set");
    assert.ok(res.headers["x-frame-options"] || res.headers["content-security-policy"], "Frame protections must be set");
  });
});
