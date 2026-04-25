const logger = require('../config/logger');
const crypto = require('crypto');

/**
 * Request logging middleware
 * Adds request ID and logs HTTP requests with duration
 */
const requestLogger = (req, res, next) => {
  // Honor upstream correlation ID or generate a new one
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;

  // Add request ID to response headers for tracking
  res.setHeader('X-Request-ID', requestId);

  // Capture request start time
  const startTime = Date.now();

  // Log request details
  logger.http({
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (...args) {
    // Calculate duration
    const duration = Date.now() - startTime;

    // Log response
    logger.http({
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });

    // Call original end method
    originalEnd.apply(res, args);
  };

  next();
};

/**
 * Error logging middleware
 * Should be added after all routes
 */
const errorLogger = (err, req, res, next) => {
  logger.error({
    requestId: req.requestId,
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    statusCode: res.statusCode || 500,
  });

  next(err);
};

module.exports = {
  requestLogger,
  errorLogger,
};
