/**
 * Startup Security Validator
 * Performs critical security checks on server startup.
 *
 * All required environment configuration must be validated here so that boot
 * fails loudly and once, rather than per-request.
 */

const logger = require('../config/logger');

const PLACEHOLDER_PATTERN = /changeme|replace[_-]?me/i;

class StartupSecurityValidator {
  constructor() {
    this.criticalErrors = [];
    this.warnings = [];

    if (!process.env.JWT_SECRET) {
      try {
        require('dotenv').config();
      } catch (_error) {
        // dotenv not available or .env file missing
      }
    }
  }

  validateJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      this.criticalErrors.push('JWT_SECRET is required but not set');
      return false;
    }

    const placeholders = [
      'GENERATE_SECURE_SECRET_FOR_PRODUCTION_USE_CRYPTO_RANDOM_BYTES_64_HEX',
      'your_jwt_secret',
      'your_very_secure_jwt_secret_here',
      'secret',
      'jwt_secret',
    ];

    if (
      placeholders.some((placeholder) => secret.toLowerCase().includes(placeholder.toLowerCase()))
    ) {
      this.criticalErrors.push('JWT_SECRET contains placeholder text - generate a secure secret');
      return false;
    }

    // 256 bits = 64 hex chars minimum
    if (secret.length < 64) {
      this.criticalErrors.push(
        `JWT_SECRET too short (${secret.length} chars, minimum 64 required)`
      );
      return false;
    }

    if (!/^[a-f0-9]+$/i.test(secret)) {
      this.warnings.push('JWT_SECRET is not in hexadecimal format (still secure but not optimal)');
    }

    return true;
  }

  validateDatabaseConfig() {
    if (!process.env.MONGODB_URI) {
      this.criticalErrors.push('MONGODB_URI is required but not set');
    }
  }

  validateSkipAuthGuard() {
    // SKIP_AUTH must never be true outside development. If it slips into
    // staging/prod via a leaked env var, fail boot rather than silently open
    // every ML endpoint.
    if (process.env.SKIP_AUTH === 'true') {
      if (process.env.NODE_ENV !== 'development') {
        this.criticalErrors.push(
          'SKIP_AUTH=true is only permitted when NODE_ENV=development; refusing to start'
        );
      } else {
        this.warnings.push(
          'SKIP_AUTH=true is active — ML endpoints require NO authentication. Development only.'
        );
      }
    }
  }

  validateProductionSettings() {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL;
    if (frontendUrl && !frontendUrl.startsWith('https://')) {
      this.criticalErrors.push('Production deployment must use HTTPS for FRONTEND_URL');
    }

    if (process.env.DEBUG) {
      this.warnings.push('DEBUG mode is enabled in production');
    }

    if (!frontendUrl || frontendUrl.includes('localhost')) {
      this.warnings.push('FRONTEND_URL should point to production domain in production');
    }

    // Reject values that look like the documented example placeholders.
    // Works in tandem with the hardened placeholders in .env.example /
    // docker-compose.yml: if anyone ships defaults to prod, boot fails.
    const sensitiveKeys = ['JWT_SECRET', 'MONGO_ROOT_PASSWORD', 'REDIS_PASSWORD'];
    for (const key of sensitiveKeys) {
      const value = process.env[key];
      if (value && PLACEHOLDER_PATTERN.test(value)) {
        this.criticalErrors.push(
          `${key} appears to be an unreplaced placeholder value; refusing to start in production`
        );
      }
    }
  }

  validateEnvironmentVariables() {
    const required = ['PORT', 'FRONTEND_URL'];
    const missing = required.filter((key) => !process.env[key]);

    missing.forEach((key) => {
      this.warnings.push(`Environment variable ${key} is not set`);
    });
  }

  validate() {
    this.validateJwtSecret();
    this.validateDatabaseConfig();
    this.validateSkipAuthGuard();
    this.validateProductionSettings();
    this.validateEnvironmentVariables();

    return {
      isValid: this.criticalErrors.length === 0,
      criticalErrors: this.criticalErrors,
      warnings: this.warnings,
    };
  }

  logResults() {
    const result = this.validate();

    if (result.criticalErrors.length > 0) {
      logger.error('🚨 CRITICAL SECURITY ERRORS detected during startup');
      result.criticalErrors.forEach((error, index) => {
        logger.error(`  ${index + 1}. ${error}`);
      });
      logger.error('Quick fixes:');
      logger.error('  • Generate JWT secret: npm run generate-jwt-secret --update-env');
      logger.error('  • Run security audit:  npm run security:audit');
      logger.error('  • Review documentation in README.md');

      return false;
    }

    if (result.warnings.length > 0) {
      logger.warn('Security warnings:');
      result.warnings.forEach((warning, index) => {
        logger.warn(`  ${index + 1}. ${warning}`);
      });
    }

    if (result.warnings.length === 0 && result.criticalErrors.length === 0) {
      logger.info('✅ Security validation passed');
    }

    return true;
  }
}

module.exports = StartupSecurityValidator;
