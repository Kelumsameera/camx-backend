// Safe structured logger that redacts sensitive information

const SENSITIVE_KEYS = ["password", "token", "secret", "authorization", "jwt", "creditcard", "cardnumber", "cvv", "gmail_app_password", "merchant_secret"];

function sanitizeObject(obj, depth = 0) {
  if (depth > 5 || obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const logger = {
  info: (message, meta = {}) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, sanitizeObject(meta));
  },
  warn: (message, meta = {}) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, sanitizeObject(meta));
  },
  error: (message, error, meta = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, {
      errorMessage: error?.message || error,
      meta: sanitizeObject(meta),
    });
  },
  security: (event, meta = {}) => {
    console.warn(`[SECURITY EVENT] ${new Date().toISOString()} - ${event}`, sanitizeObject(meta));
  },
};

export default logger;
