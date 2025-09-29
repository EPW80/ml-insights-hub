/**
 * Startup Security Validator
 * Performs critical security checks on server startup
 */

const crypto = require('crypto');

class StartupSecurityValidator {
  constructor() {
    this.criticalErrors = [];
    this.warnings = [];
    
    // Ensure environment variables are loaded
    if (!process.env.JWT_SECRET) {
      try {
        require('dotenv').config();
      } catch (error) {
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

    // Check for placeholder values
    const placeholders = [
      'GENERATE_SECURE_SECRET_FOR_PRODUCTION_USE_CRYPTO_RANDOM_BYTES_64_HEX',
      'your_jwt_secret',
      'secret',
      'jwt_secret'
    ];

    if (placeholders.some(placeholder => secret.toLowerCase().includes(placeholder.toLowerCase()))) {
      this.criticalErrors.push('JWT_SECRET contains placeholder text - generate a secure secret');
      return false;
    }

    // Check minimum length (256 bits = 64 hex chars)
    if (secret.length < 64) {
      this.criticalErrors.push(`JWT_SECRET too short (${secret.length} chars, minimum 64 required)`);
      return false;
    }

    // Check for hex format (recommended)
    if (!/^[a-f0-9]+$/i.test(secret)) {
      this.warnings.push('JWT_SECRET is not in hexadecimal format (still secure but not optimal)');
    }

    return true;
  }

  validateProductionSettings() {
    if (process.env.NODE_ENV === 'production') {
      // Check HTTPS requirement
      const frontendUrl = process.env.FRONTEND_URL;
      if (frontendUrl && !frontendUrl.startsWith('https://')) {
        this.criticalErrors.push('Production deployment must use HTTPS for FRONTEND_URL');
      }

      // Check for development configurations
      if (process.env.DEBUG) {
        this.warnings.push('DEBUG mode is enabled in production');
      }

      // Validate CORS settings
      if (!frontendUrl || frontendUrl.includes('localhost')) {
        this.warnings.push('FRONTEND_URL should point to production domain in production');
      }
    }
  }

  validateEnvironmentVariables() {
    const required = ['PORT', 'FRONTEND_URL'];
    const missing = required.filter(key => !process.env[key]);
    
    missing.forEach(key => {
      this.warnings.push(`Environment variable ${key} is not set`);
    });
  }

  validate() {
    this.validateJwtSecret();
    this.validateProductionSettings();
    this.validateEnvironmentVariables();

    return {
      isValid: this.criticalErrors.length === 0,
      criticalErrors: this.criticalErrors,
      warnings: this.warnings
    };
  }

  logResults() {
    const result = this.validate();
    
    if (result.criticalErrors.length > 0) {
      console.error('\n🚨 CRITICAL SECURITY ERRORS:');
      result.criticalErrors.forEach((error, index) => {
        console.error(`${index + 1}. ❌ ${error}`);
      });
      console.error('\n💡 Quick fixes:');
      console.error('   • Generate JWT secret: npm run generate-jwt-secret --update-env');
      console.error('   • Run security audit: npm run security-audit');
      console.error('   • Check documentation: README.md\n');
      
      return false;
    }

    if (result.warnings.length > 0) {
      console.warn('\n⚠️  Security Warnings:');
      result.warnings.forEach((warning, index) => {
        console.warn(`${index + 1}. ${warning}`);
      });
      console.warn('');
    }

    if (result.warnings.length === 0 && result.criticalErrors.length === 0) {
      console.log('✅ Security validation passed');
    }

    return true;
  }
}

module.exports = StartupSecurityValidator;