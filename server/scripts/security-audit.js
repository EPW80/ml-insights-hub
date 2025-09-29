#!/usr/bin/env node

/**
 * Security Audit Script for ML Insights Hub
 * Comprehensive security validation and recommendations
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables
require('dotenv').config();

class SecurityAuditor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.recommendations = [];
    this.score = 100;
  }

  // Check JWT secret security
  auditJwtSecret() {
    console.log('🔐 Auditing JWT Secret Configuration...');
    
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      this.addIssue('CRITICAL', 'No JWT_SECRET found in environment', [
        'Generate a secure JWT secret using: npm run generate-jwt-secret --update-env',
        'Never commit real secrets to version control'
      ]);
      return;
    }

    // Validate secret strength
    const minLength = 64; // 256 bits
    const isHex = /^[a-f0-9]+$/i.test(secret);
    const entropyBits = secret.length * 4;

    if (secret.length < minLength) {
      this.addIssue('HIGH', `JWT secret too short (${secret.length} chars, minimum ${minLength})`, [
        'Generate a new secure secret: npm run generate-jwt-secret --update-env'
      ]);
    } else if (!isHex) {
      this.addWarning('JWT secret is not hexadecimal format', [
        'Consider using hex format for better entropy distribution'
      ]);
    } else {
      console.log(`✅ JWT Secret: SECURE (${secret.length} chars, ${entropyBits} bits entropy)`);
    }

    // Check for common weak secrets
    const weakSecrets = [
      'secret',
      'jwt_secret',
      'your_jwt_secret',
      '123456',
      'password',
      'GENERATE_SECURE_SECRET_FOR_PRODUCTION_USE_CRYPTO_RANDOM_BYTES_64_HEX'
    ];

    if (weakSecrets.some(weak => secret.toLowerCase().includes(weak.toLowerCase()))) {
      this.addIssue('CRITICAL', 'JWT secret contains weak or placeholder text', [
        'Generate a new cryptographically secure secret immediately'
      ]);
    }
  }

  // Check environment configuration
  auditEnvironmentConfig() {
    console.log('🌍 Auditing Environment Configuration...');

    const nodeEnv = process.env.NODE_ENV;
    const port = process.env.PORT;
    const frontendUrl = process.env.FRONTEND_URL;

    // Check NODE_ENV
    if (!nodeEnv) {
      this.addWarning('NODE_ENV not set', [
        'Set NODE_ENV=production for production deployments'
      ]);
    } else if (nodeEnv === 'production') {
      console.log('✅ NODE_ENV: Production mode detected');
      this.auditProductionSecurity();
    } else {
      console.log(`⚠️  NODE_ENV: ${nodeEnv} (development mode)`);
    }

    // Check port configuration
    if (!port) {
      this.addWarning('PORT not specified', [
        'Explicitly set PORT environment variable'
      ]);
    }

    // Check CORS configuration
    if (!frontendUrl) {
      this.addWarning('FRONTEND_URL not specified', [
        'Set specific frontend URL for CORS security'
      ]);
    } else if (frontendUrl.includes('*') || frontendUrl === 'http://localhost:3000') {
      if (nodeEnv === 'production') {
        this.addIssue('HIGH', 'Insecure CORS configuration in production', [
          'Set specific domain for FRONTEND_URL in production'
        ]);
      }
    }
  }

  // Production-specific security checks
  auditProductionSecurity() {
    console.log('🏭 Auditing Production Security...');

    // Check HTTPS
    const frontendUrl = process.env.FRONTEND_URL;
    if (frontendUrl && !frontendUrl.startsWith('https://')) {
      this.addIssue('HIGH', 'Frontend URL not using HTTPS in production', [
        'Use HTTPS URLs in production: https://yourdomain.com'
      ]);
    }

    // Check for development dependencies
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (packageJson.dependencies && packageJson.dependencies.nodemon) {
        this.addWarning('Development dependencies in production build', [
          'Move nodemon to devDependencies'
        ]);
      }
    } catch (error) {
      // Package.json not found or invalid
    }

    // Check for debug configurations
    if (process.env.DEBUG) {
      this.addWarning('DEBUG mode enabled in production', [
        'Disable debug logging in production'
      ]);
    }
  }

  // Check file permissions and security
  auditFilePermissions() {
    console.log('📁 Auditing File Permissions...');

    const sensitiveFiles = [
      '.env',
      'scripts/generate-jwt-secret.js',
      'config/'
    ];

    sensitiveFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          const mode = (stats.mode & parseInt('777', 8)).toString(8);
          
          if (file === '.env' && mode !== '600') {
            this.addWarning(`Insecure permissions on ${file} (${mode})`, [
              `Set secure permissions: chmod 600 ${file}`
            ]);
          }
        } catch (error) {
          this.addWarning(`Could not check permissions for ${file}`, []);
        }
      }
    });
  }

  // Check dependencies for security vulnerabilities
  auditDependencies() {
    console.log('📦 Auditing Dependencies...');

    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);

      if (audit.metadata && audit.metadata.vulnerabilities) {
        const vulns = audit.metadata.vulnerabilities;
        const total = vulns.total;

        if (total > 0) {
          const critical = vulns.critical || 0;
          const high = vulns.high || 0;
          const moderate = vulns.moderate || 0;

          if (critical > 0) {
            this.addIssue('CRITICAL', `${critical} critical vulnerabilities found`, [
              'Run: npm audit fix',
              'Review and update vulnerable packages'
            ]);
          }

          if (high > 0) {
            this.addIssue('HIGH', `${high} high severity vulnerabilities found`, [
              'Run: npm audit fix',
              'Consider updating vulnerable packages'
            ]);
          }

          if (moderate > 0) {
            this.addWarning(`${moderate} moderate vulnerabilities found`, [
              'Run: npm audit fix when convenient'
            ]);
          }
        } else {
          console.log('✅ Dependencies: No known vulnerabilities');
        }
      }
    } catch (error) {
      this.addWarning('Could not run dependency audit', [
        'Manually run: npm audit'
      ]);
    }
  }

  // Helper methods
  addIssue(severity, message, recommendations) {
    this.issues.push({ severity, message, recommendations });
    
    // Deduct points based on severity
    const deductions = { CRITICAL: 30, HIGH: 20, MEDIUM: 10 };
    this.score -= (deductions[severity] || 5);
  }

  addWarning(message, recommendations) {
    this.warnings.push({ message, recommendations });
    this.score -= 5;
  }

  // Generate security report
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🛡️  SECURITY AUDIT REPORT');
    console.log('='.repeat(60));

    // Security Score
    const scoreColor = this.score >= 90 ? '🟢' : this.score >= 70 ? '🟡' : '🔴';
    console.log(`${scoreColor} Security Score: ${Math.max(0, this.score)}/100\n`);

    // Critical Issues
    if (this.issues.length > 0) {
      console.log('🚨 SECURITY ISSUES:');
      this.issues.forEach((issue, index) => {
        const emoji = issue.severity === 'CRITICAL' ? '🔴' : 
                     issue.severity === 'HIGH' ? '🟠' : '🟡';
        console.log(`${index + 1}. ${emoji} [${issue.severity}] ${issue.message}`);
        
        if (issue.recommendations.length > 0) {
          console.log('   Solutions:');
          issue.recommendations.forEach(rec => {
            console.log(`   • ${rec}`);
          });
        }
        console.log('');
      });
    }

    // Warnings
    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. 🟡 ${warning.message}`);
        
        if (warning.recommendations.length > 0) {
          console.log('   Recommendations:');
          warning.recommendations.forEach(rec => {
            console.log(`   • ${rec}`);
          });
        }
        console.log('');
      });
    }

    // Overall assessment
    console.log('📋 OVERALL ASSESSMENT:');
    if (this.score >= 90) {
      console.log('✅ Excellent security posture');
    } else if (this.score >= 70) {
      console.log('⚠️  Good security with room for improvement');
    } else {
      console.log('🚨 Security improvements required before production');
    }

    console.log('\n' + '='.repeat(60));
    
    return {
      score: Math.max(0, this.score),
      issues: this.issues,
      warnings: this.warnings,
      passed: this.score >= 70
    };
  }

  // Run complete audit
  async runAudit() {
    console.log('🔍 Starting Security Audit...\n');

    this.auditJwtSecret();
    this.auditEnvironmentConfig();
    this.auditFilePermissions();
    this.auditDependencies();

    return this.generateReport();
  }
}

// Main execution
if (require.main === module) {
  const auditor = new SecurityAuditor();
  
  auditor.runAudit()
    .then(result => {
      if (!result.passed) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ Security audit failed:', error.message);
      process.exit(1);
    });
}

module.exports = SecurityAuditor;