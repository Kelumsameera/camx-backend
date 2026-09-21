import { test, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import crypto from "crypto";
import app from "../index.js";
import Order from "../models/Order.js";

process.env.PAYHERE_MERCHANT_ID = "TEST_MERCHANT_ID";
process.env.PAYHERE_MERCHANT_SECRET = "TEST_MERCHANT_SECRET";
process.env.PAYHERE_SANDBOX = "true";

function md5(input) {
  return crypto.createHash("md5").update(input).digest("hex").toUpperCase();
}

describe("Payment & PayHere Gateway Tests", () => {
  test("PayHere hash generation creates valid MD5 signature for order", async () => {
    const originalFindOne = Order.findOne;
    const testOrderId = "507f1f77bcf86cd799439011";

    Order.findOne = async () => ({
      _id: testOrderId,
      orderId: "ORD-12345",
      name: "Kasun Silva",
      email: "kasun@example.com",
      phone: "0771234567",
      address: "123 Main St",
      city: "Colombo",
      paymentMethod: "CARD",
      paymentStatus: "Pending",
      total: 7500,
      save: async () => {},
    });

    try {
      const res = await request(app).post("/api/payments/payhere/hash").send({ orderId: testOrderId });

      assert.equal(res.status, 200);
      assert.equal(res.body.merchant_id, "TEST_MERCHANT_ID");
      assert.equal(res.body.amount, "7500.00");
      assert.equal(res.body.currency, "LKR");

      // Verify computed hash matches expected PayHere formula
      const secretHash = md5("TEST_MERCHANT_SECRET");
      const expectedHash = md5(`TEST_MERCHANT_ID${testOrderId}7500.00LKR${secretHash}`);
      assert.equal(res.body.hash, expectedHash);
    } finally {
      Order.findOne = originalFindOne;
    }
  });

  test("PayHere notify handles valid signature and transitions order to Paid", async () => {
    const originalFindOne = Order.findOne;
    const testOrderId = "507f1f77bcf86cd799439011";
    let savedStatus = null;
    let savedPaymentStatus = null;

    Order.findOne = async () => ({
      _id: testOrderId,
      orderId: "ORD-12345",
      total: 7500,
      paymentMethod: "CARD",
      paymentStatus: "Pending",
      status: "pending",
      save: async function () {
        savedStatus = this.status;
        savedPaymentStatus = this.paymentStatus;
        return this;
      },
    });

    const merchantId = "TEST_MERCHANT_ID";
    const amount = "7500.00";
    const currency = "LKR";
    const statusCode = "2"; // 2 = Success
    const secretHash = md5("TEST_MERCHANT_SECRET");
    const validMd5Sig = md5(`${merchantId}${testOrderId}${amount}${currency}${statusCode}${secretHash}`);

    try {
      const res = await request(app).post("/api/payments/payhere/notify").type("form").send({
        merchant_id: merchantId,
        order_id: testOrderId,
        payment_id: "320025112522",
        payhere_amount: amount,
        payhere_currency: currency,
        status_code: statusCode,
        md5sig: validMd5Sig,
        method: "VISA",
      });

      assert.equal(res.status, 200);
      assert.equal(savedPaymentStatus, "Paid");
      assert.equal(savedStatus, "paid");
    } finally {
      Order.findOne = originalFindOne;
    }
  });
});
