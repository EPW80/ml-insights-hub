const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JWTSecurity {
  constructor() {
    this.validateJWTSecret();
  }

  // Validate that JWT secret meets security requirements
  validateJWTSecret() {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    // Check if secret is still the default placeholder
    if (secret.includes('GENERATE_SECURE_SECRET') || secret.length < 64) {
      console.error('🔴 SECURITY WARNING: JWT_SECRET is not secure!');
      console.error('Generate a secure secret using:');
      console.error("node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"");
      
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Insecure JWT_SECRET detected in production environment');
      }
    }
    
    // Ensure minimum entropy (256 bits = 64 hex characters)
    if (secret.length < 64) {
      console.warn('⚠️  JWT_SECRET should be at least 64 characters (256 bits) for optimal security');
    }
  }

  // Generate a cryptographically secure JWT secret
  static generateSecureSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  // Sign JWT with additional security claims
  signToken(payload, options = {}) {
    const defaultOptions = {
      expiresIn: process.env.JWT_EXPIRE || '7d',
      issuer: 'ml-insights-hub',
      audience: 'ml-insights-hub-users',
      algorithm: 'HS256'
    };

    // Add security metadata
    const securePayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID(), // JWT ID for token tracking
    };

    return jwt.sign(securePayload, process.env.JWT_SECRET, {
      ...defaultOptions,
      ...options
    });
  }

  // Verify JWT with comprehensive checks
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'ml-insights-hub',
        audience: 'ml-insights-hub-users',
        algorithms: ['HS256']
      });

      // Additional security checks
      if (!decoded.jti) {
        throw new Error('Token missing JWT ID');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not active yet');
      }
      throw error;
    }
  }

  // Refresh token with extended expiry
  refreshToken(oldToken) {
    try {
      const decoded = this.verifyToken(oldToken);
      
      // Remove old timestamp claims
      delete decoded.iat;
      delete decoded.exp;
      delete decoded.nbf;
      
      // Generate new token with fresh JWT ID
      return this.signToken(decoded);
    } catch (error) {
      throw new Error('Cannot refresh invalid token');
    }
  }
}

// Middleware to check JWT token security
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied',
      message: 'No token provided' 
    });
  }

  try {
    const jwtSecurity = new JWTSecurity();
    const decoded = jwtSecurity.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ 
      error: 'Invalid token',
      message: error.message 
    });
  }
};

module.exports = {
  JWTSecurity,
  authenticateToken
};
