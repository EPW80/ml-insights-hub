/**
 * ML-specific Authentication and Authorization Middleware
 * Provides comprehensive security for ML endpoints
 */

const jwt = require('jsonwebtoken');

/**
 * Enhanced authentication middleware with detailed error messages
 */
const requireAuth = (req, res, next) => {
  try {
    // DEVELOPMENT MODE: Skip authentication if SKIP_AUTH environment variable is set
    if (process.env.SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      req.user = {
        id: 'dev-user',
        email: 'dev@localhost',
        role: 'user',
        username: 'development'
      };
      console.log('⚠️  Development mode: Authentication skipped for', req.path);
      return next();
    }

    // Extract token from Authorization header
    const authHeader = req.header('Authorization');

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'No authorization header provided',
        type: 'MISSING_AUTH_HEADER'
      });
    }

    // Validate Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authorization format',
        message: 'Authorization header must use Bearer scheme',
        type: 'INVALID_AUTH_FORMAT'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token || token.trim() === '') {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        message: 'Bearer token is empty',
        type: 'EMPTY_TOKEN'
      });
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret || jwtSecret === 'GENERATE_SECURE_SECRET_FOR_PRODUCTION_USE_CRYPTO_RANDOM_BYTES_64_HEX') {
      console.error('🚨 CRITICAL SECURITY ERROR: JWT_SECRET not properly configured!');
      return res.status(500).json({
        success: false,
        error: 'Server authentication not configured',
        message: 'Contact system administrator',
        type: 'SERVER_CONFIG_ERROR'
      });
    }

    const decoded = jwt.verify(token, jwtSecret);

    // Attach user info to request
    req.user = {
      id: decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user',
      username: decoded.username
    };

    // Log authentication success (in development)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ User authenticated: ${req.user.email} (${req.user.role})`);
    }

    next();

  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
        type: 'TOKEN_EXPIRED',
        expiredAt: error.expiredAt
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'The provided token is invalid or malformed',
        type: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'NotBeforeError') {
      return res.status(401).json({
        success: false,
        error: 'Token not active',
        message: 'This token is not yet valid',
        type: 'TOKEN_NOT_ACTIVE'
      });
    }

    // Generic error
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: 'Unable to authenticate request',
      type: 'AUTH_ERROR'
    });
  }
};

/**
 * Admin-only middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'You must be logged in to access this resource',
      type: 'NOT_AUTHENTICATED'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Insufficient permissions',
      message: 'Admin access required for this operation',
      type: 'INSUFFICIENT_PERMISSIONS',
      userRole: req.user.role,
      requiredRole: 'admin'
    });
  }

  next();
};

/**
 * Optional authentication - attaches user if token is valid but doesn't require it
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth provided, continue without user
      req.user = null;
      return next();
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token || token.trim() === '') {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user',
      username: decoded.username
    };

    next();

  } catch (error) {
    // If token is invalid, just continue without user
    req.user = null;
    next();
  }
};

/**
 * Rate limiting by user - tracks usage per user
 */
const userRateLimiter = (maxRequests = 100, windowMs = 900000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next(); // Skip if no user (will be caught by requireAuth)
    }

    const userId = req.user.id;
    const now = Date.now();

    // Clean up old entries
    if (userRequests.has(userId)) {
      const userRecord = userRequests.get(userId);
      userRecord.requests = userRecord.requests.filter(
        timestamp => now - timestamp < windowMs
      );
    } else {
      userRequests.set(userId, { requests: [] });
    }

    const userRecord = userRequests.get(userId);

    if (userRecord.requests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: `You have exceeded the limit of ${maxRequests} requests per ${windowMs / 1000 / 60} minutes`,
        type: 'USER_RATE_LIMIT',
        resetAt: new Date(userRecord.requests[0] + windowMs).toISOString()
      });
    }

    userRecord.requests.push(now);
    next();
  };
};

/**
 * API key authentication (alternative to JWT)
 */
const requireApiKey = (req, res, next) => {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
      message: 'Provide API key in X-API-Key header',
      type: 'MISSING_API_KEY'
    });
  }

  // Validate API key (should be stored in database in production)
  const validApiKeys = (process.env.API_KEYS || '').split(',').filter(k => k);

  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
      message: 'The provided API key is not valid',
      type: 'INVALID_API_KEY'
    });
  }

  // Attach API key info to request
  req.apiKey = apiKey;
  req.user = {
    type: 'api_key',
    role: 'user' // API keys have user-level access by default
  };

  next();
};

/**
 * Flexible auth - accepts either JWT or API key
 */
const requireAuthOrApiKey = (req, res, next) => {
  // DEVELOPMENT MODE: Skip authentication if SKIP_AUTH environment variable is set
  if (process.env.SKIP_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    req.user = {
      id: 'dev-user',
      email: 'dev@localhost',
      role: 'user',
      username: 'development'
    };
    console.log('⚠️  Development mode: Authentication skipped for', req.path);
    return next();
  }

  const authHeader = req.header('Authorization');
  const apiKey = req.header('X-API-Key');

  if (apiKey) {
    return requireApiKey(req, res, next);
  } else if (authHeader) {
    return requireAuth(req, res, next);
  } else {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Provide either Authorization header (Bearer token) or X-API-Key header',
      type: 'NO_AUTH_PROVIDED'
    });
  }
};

/**
 * Log authenticated requests (for audit trail)
 */
const logAuthenticatedRequest = (req, res, next) => {
  if (req.user) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - User: ${req.user.email || req.user.id} (${req.user.role})`);
  }
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  optionalAuth,
  requireApiKey,
  requireAuthOrApiKey,
  userRateLimiter,
  logAuthenticatedRequest,

  // Legacy exports for compatibility
  authMiddleware: requireAuth,
  adminMiddleware: requireAdmin
};
