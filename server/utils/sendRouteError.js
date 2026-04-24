/**
 * Shared error response helper for ML route handlers.
 *
 * Classifies the error (validation, Python execution/timeout/security, DB)
 * and sends a sanitized JSON response. Consolidates what was previously
 * duplicated in routes/ml/predict.js and routes/ml/analyze.js.
 */

const logger = require('../config/logger');
const {
  PythonExecutionError,
  PythonTimeoutError,
  PythonSecurityError,
} = require('./securePythonBridge');

// Legacy alias retained for backward compatibility with existing call sites.
const PythonParseError = PythonExecutionError;

function sendRouteError(res, error, statusCode = 500, req = null) {
  const errorResponse = {
    success: false,
    error: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  };

  if (error instanceof PythonExecutionError) {
    errorResponse.type = 'python_execution_error';
    errorResponse.details = {
      exitCode: error.details?.exitCode,
      executionTime: error.details?.executionTime,
    };
    statusCode = 422;
  } else if (error instanceof PythonTimeoutError) {
    errorResponse.type = 'timeout_error';
    errorResponse.details = {
      timeout: error.details?.timeout,
      retryCount: error.details?.retryCount,
    };
    statusCode = 408;
  } else if (error instanceof PythonSecurityError) {
    errorResponse.type = 'security_error';
    errorResponse.details = {
      securityViolation: error.type,
      timestamp: error.timestamp,
    };
    statusCode = 403;
    logger.error('Security violation in ML route', {
      error: error.message,
      type: error.type,
      timestamp: error.timestamp,
      userAgent: req ? req.get('User-Agent') : 'unknown',
      ip: req ? req.ip : 'unknown',
    });
  } else if (error.name === 'ValidationError') {
    errorResponse.type = 'database_validation_error';
    errorResponse.details = Object.keys(error.errors || {});
    statusCode = 400;
  } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    errorResponse.type = 'database_error';
    statusCode = 503;
  }

  logger.error('Route error', {
    type: errorResponse.type,
    message: error.message,
    stack: error.stack,
    details: error.details,
  });

  res.status(statusCode).json(errorResponse);
}

module.exports = { sendRouteError, PythonParseError };
