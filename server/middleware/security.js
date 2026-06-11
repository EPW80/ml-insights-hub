const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const { createClient } = require('redis');
const { RedisStore } = require('rate-limit-redis');
const logger = require('../config/logger');

// Redis client for rate limiting (shared across replicas)
let redisClient = null;
let redisStore = null;

async function initRedisRateLimitStore() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.info('REDIS_URL not configured. Rate limiter using in-memory store.');
    return;
  }

  try {
    redisClient = createClient({ url: redisUrl });

    // Log only the first error to avoid log spam during reconnect attempts
    let errorLogged = false;
    redisClient.on('error', (err) => {
      if (!errorLogged) {
        errorLogged = true;
        logger.warn(`Redis connection error: ${err.message}. Rate limiter using in-memory store.`);
      }
    });

    await redisClient.connect();
    redisStore = new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: 'rl:',
    });
    logger.info('Rate limiter connected to Redis');
  } catch (err) {
    logger.warn(`Redis unavailable (${err.message}). Rate limiter using in-memory store.`);
    // Disconnect to stop the client retrying and emitting repeated error events
    if (redisClient) {
      redisClient.disconnect();
      redisClient = null;
    }
    redisStore = null;
  }
}

// Initialize Redis connection (non-blocking)
initRedisRateLimitStore();

// Rate limiting configurations — limiters are created lazily on first request so
// that redisStore has time to resolve from the async init above before being read.
const createRateLimit = (windowMs, max, message) => {
  let limiter = null;
  return (req, res, next) => {
    if (!limiter) {
      const opts = {
        windowMs,
        max,
        message: {
          error: message,
          retryAfter: Math.ceil(windowMs / 1000),
        },
        standardHeaders: true,
        legacyHeaders: false,
      };
      if (redisStore) {
        opts.store = redisStore;
      }
      limiter = rateLimit(opts);
    }
    return limiter(req, res, next);
  };
};

// General API rate limit
const generalLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many requests from this IP, please try again later.'
);

// Strict rate limit for ML endpoints (computationally expensive)
const mlLimiter = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  30, // limit each IP to 30 ML requests per 5 minutes
  'Too many ML requests from this IP. ML operations are resource-intensive, please wait before trying again.'
);

// Authentication rate limit (prevent brute force)
const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 auth attempts per windowMs
  'Too many authentication attempts from this IP, please try again later.'
);

// File upload rate limit
const uploadLimiter = createRateLimit(
  60 * 1000, // 1 minute
  5, // limit each IP to 5 uploads per minute
  'Too many file uploads from this IP, please try again later.'
);

// Input validation middleware
const validateMLInput = [
  body('data')
    .isArray()
    .withMessage('Data must be an array')
    .custom((value) => {
      if (value.length > 10000) {
        throw new Error('Dataset too large. Maximum 10,000 records allowed.');
      }
      return true;
    }),

  body('features').optional().isArray().withMessage('Features must be an array'),

  body('modelType')
    .isIn(['linear', 'random_forest', 'xgboost', 'neural_network', 'kmeans', 'pca'])
    .withMessage('Invalid model type'),

  body('parameters')
    .optional()
    .isObject()
    .withMessage('Parameters must be an object')
    .custom((value) => {
      // Validate specific parameter ranges
      if (value.max_depth && (value.max_depth < 1 || value.max_depth > 20)) {
        throw new Error('max_depth must be between 1 and 20');
      }
      if (value.n_estimators && (value.n_estimators < 1 || value.n_estimators > 1000)) {
        throw new Error('n_estimators must be between 1 and 1000');
      }
      return true;
    }),

  // Check validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }
    return next();
  },
];

const validateDataUpload = [
  body('filename')
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Filename contains invalid characters'),

  body('fileType')
    .isIn(['csv', 'json', 'xlsx'])
    .withMessage('Invalid file type. Only CSV, JSON, and XLSX allowed.'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }
    return next();
  },
];

const validateAuth = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    ),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }
    return next();
  },
];

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for development
});

// MongoDB injection prevention
const mongoSanitizer = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`Sanitized key ${key} in request to ${req.originalUrl}`);
  },
});

// Request size limiter
const requestSizeLimiter = (req, res, next) => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const contentLength = parseInt(req.get('content-length'));

  if (contentLength && contentLength > maxSize) {
    return res.status(413).json({
      error: 'Request too large',
      message: 'Maximum request size is 10MB',
    });
  }
  return next();
};

// Error handling middleware for rate limiting
const handleRateLimit = (error, req, res, next) => {
  if (error.name === 'RateLimitError') {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: error.message,
      retryAfter: error.retryAfter,
    });
  }
  return next(error);
};

module.exports = {
  generalLimiter,
  mlLimiter,
  authLimiter,
  uploadLimiter,
  validateMLInput,
  validateDataUpload,
  validateAuth,
  securityHeaders,
  mongoSanitizer,
  requestSizeLimiter,
  handleRateLimit,
};
