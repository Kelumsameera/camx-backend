import logger from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || (res.statusCode >= 400 ? res.statusCode : 500);
  const isProduction = process.env.NODE_ENV === "production";

  // Generate a request identifier if not present
  const requestId = req.headers["x-request-id"] || `req-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // Log detailed error securely on server
  logger.error(`Request Error [${req.method} ${req.originalUrl}] - Status: ${statusCode}`, err, {
    requestId,
    ip: req.ip,
    userEmail: req.user?.email,
  });

  // Client response
  const message = statusCode >= 500 ? (isProduction ? "Internal server error" : err.message || "Internal server error") : err.message || "An error occurred";

  res.status(statusCode).json({
    success: false,
    message,
    ...(isProduction ? { requestId } : { requestId, stack: err.stack }),
  });
}

export default errorHandler;
