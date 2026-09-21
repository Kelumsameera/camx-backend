import xss from "xss";

// Options to strip all dangerous script tags, iframes, javascript:, and event handlers
const xssOptions = {
  whiteList: {
    b: [],
    i: [],
    em: [],
    strong: [],
    a: ["href", "title", "target"],
    p: [],
    br: [],
    ul: [],
    ol: [],
    li: [],
    span: ["class"],
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "iframe", "object", "embed", "applet"],
};

const customXSS = new xss.FilterXSS(xssOptions);

export function sanitizeHtml(input) {
  if (typeof input !== "string") return input;
  return customXSS.process(input).trim();
}

export function sanitizeText(input) {
  if (typeof input !== "string") return input;
  // Strip all HTML tags completely for plain text fields
  return input.replace(/<[^>]*>?/gm, "").trim();
}

export function sanitizeObjectStrings(obj) {
  if (!obj) return obj;

  if (typeof obj === "string") {
    return sanitizeHtml(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObjectStrings(item));
  }

  if (typeof obj === "object") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObjectStrings(value);
    }
    return result;
  }

  return obj;
}

export default { sanitizeHtml, sanitizeText, sanitizeObjectStrings };
