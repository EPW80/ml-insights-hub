/**
 * Centralized Express error-handling middleware.
 *
 * Responsibilities:
 *   - Log every failed request once, via Winston, with request context.
 *   - Classify well-known error shapes (Mongo, Multer, JSON, Python bridge).
 *   - Return a sanitized JSON body that never leaks stack traces or internal
 *     messages to production clients.
 */

const logger = require('../config/logger');
const {
  PythonExecutionError,
  PythonTimeoutError,
  PythonSecurityError,
} = require('../utils/securePythonBridge');

function classify(error) {
  // Python bridge errors first — they are the most specific in this codebase.
  if (error instanceof PythonSecurityError) {
    return { statusCode: 403, errorType: 'security_error', message: 'Security policy violation' };
  }
  if (error instanceof PythonTimeoutError) {
    return { statusCode: 408, errorType: 'timeout_error', message: 'Request timed out' };
  }
  if (error instanceof PythonExecutionError) {
    return {
      statusCode: 422,
      errorType: 'python_execution_error',
      message: 'ML script failed to complete',
    };
  }

  if (error.name === 'ValidationError') {
    return { statusCode: 400, errorType: 'validation_error', message: 'Request validation failed' };
  }
  if (error.name === 'CastError') {
    return { statusCode: 400, errorType: 'cast_error', message: 'Invalid data format' };
  }
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    return { statusCode: 503, errorType: 'database_error', message: 'Database operation failed' };
  }
  // Express' body-parser wraps malformed JSON in a SyntaxError with
  // `type: 'entity.parse.failed'`. Our own `verify` hook throws an Error with
  // message 'Invalid JSON'. Handle both.
  if (
    error.message === 'Invalid JSON' ||
    error.type === 'entity.parse.failed' ||
    (error instanceof SyntaxError && error.status === 400 && 'body' in error)
  ) {
    return {
      statusCode: 400,
      errorType: 'json_parse_error',
      message: 'Request body contains invalid JSON',
    };
  }
  if (error.name === 'MulterError') {
    return { statusCode: 400, errorType: 'file_upload_error', message: 'File upload failed' };
  }
  if (error.code === 'ENOENT') {
    return {
      statusCode: 404,
      errorType: 'file_not_found',
      message: 'Requested resource not found',
    };
  }
  if (error.code === 'EACCES') {
    return { statusCode: 403, errorType: 'permission_denied', message: 'Access denied' };
  }
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
    return {
      statusCode: 503,
      errorType: 'service_unavailable',
      message: 'External service unavailable',
    };
  }

  return { statusCode: 500, errorType: 'internal_server_error', message: error.message };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, _next) {
  const timestamp = new Date().toISOString();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;

  logger.error({
    timestamp,
    requestId,
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
  });

  const { statusCode, errorType, message } = classify(error);
  const isProduction = process.env.NODE_ENV === 'production';

  const errorResponse = {
    success: false,
    error: {
      type: errorType,
      // In production, never leak raw error messages for 5xx — clients get a
      // generic string. 4xx messages are safe because classify() owns them.
      message: isProduction && statusCode >= 500 ? 'Internal server error' : message,
      timestamp,
      requestId,
    },
  };

  if (!isProduction) {
    errorResponse.error.details = {
      name: error.name,
      stack: error.stack,
      url: req.url,
      method: req.method,
    };
  }

  if (error.errors) {
    errorResponse.error.validation_errors = Object.keys(error.errors).map((field) => ({
      field,
      message: error.errors[field].message,
    }));
  }

  res.status(statusCode).json(errorResponse);
}

module.exports = errorHandler;
