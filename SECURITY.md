# Security Documentation - ML Insights Hub

## Overview

This document outlines the comprehensive security measures implemented in the ML Insights Hub application. The security architecture follows industry best practices and implements defense-in-depth strategies.

---

## 🔒 Security Architecture

### 1. Authentication & Authorization

#### JWT-Based Authentication
- **Implementation**: `server/middleware/mlAuth.js`
- **Token Format**: Bearer tokens in Authorization header
- **Token Expiry**: Configurable via `JWT_EXPIRE` environment variable (default: 7 days)
- **Secret Management**: JWT_SECRET must be 64+ hex characters (256-bit entropy minimum)

#### API Key Authentication (Alternative)
- **Header**: `X-API-Key`
- **Use Case**: Service-to-service communication, automated scripts
- **Configuration**: Set `API_KEYS` in environment variables (comma-separated)

#### Protected Endpoints
All ML endpoints require authentication:
- `/api/ml/predict` - Prediction services
- `/api/ml/train` - Model training
- `/api/ml/analyze` - Data analysis
- `/api/ml/versions` - Model versioning
- `/api/ml/ab-test` - A/B testing
- `/api/ml/auto-retrain` - Automated retraining
- `/api/ml/explainability` - Model explainability

#### Authentication Methods

```javascript
// JWT Authentication
const response = await fetch('/api/ml/predict', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  }
});

// API Key Authentication
const response = await fetch('/api/ml/predict', {
  headers: {
    'X-API-Key': 'your-api-key-here',
    'Content-Type': 'application/json'
  }
});
```

### 2. Input Validation

#### Node.js Layer (`securePythonBridge.js`)
- **Input Size Limits**: 1MB maximum
- **Blocked Patterns**: Prevents code injection, path traversal, XSS
- **JSON Validation**: Strict JSON parsing with error handling
- **Script Path Validation**: Whitelist-based script execution

#### Python Layer (`input_validator.py`)
- **Type Validation**: Enforces correct data types for all inputs
- **Range Validation**: Numeric bounds checking
- **String Sanitization**: XSS and injection prevention
- **Array Length Limits**: Prevents memory exhaustion
- **Nested Depth Limits**: Prevents stack overflow attacks

Example Python validation:

```python
from input_validator import MLInputValidator, InputValidationError

try:
    features = MLInputValidator.validate_features(input_data['features'])
    model_type = InputValidator.validate_enum(
        input_data['model_type'],
        'model_type',
        MLInputValidator.ALLOWED_MODEL_TYPES
    )
except InputValidationError as e:
    send_error(e.message, e.field)
```

### 3. Python Script Execution Security

#### Secure Execution Environment
- **Sandboxing**: Limited environment variables
- **Process Isolation**: No privilege escalation
- **Resource Limits**:
  - Max execution time: 30 seconds
  - Max output size: 5MB
  - Max concurrent executions: 3
  - Memory limit: 512MB

#### Whitelisted Script Patterns
Only scripts matching these patterns can execute:
- `predict_*.py`
- `train_*.py`
- `analyze_*.py`
- `validate_*.py`
- `test_connection.py`

#### Blocked Operations
Python scripts cannot:
- Import `os`, `subprocess`, `sys` modules (in input data)
- Use `exec()`, `eval()`, `compile()`
- Access system directories (`/etc/`, `/proc/`, `/dev/`)
- Perform path traversal (`../`)

### 4. Database Security

#### MongoDB Security
- **Connection**: Environment-based configuration (no hardcoded credentials)
- **NoSQL Injection Prevention**: `express-mongo-sanitize` middleware
- **Connection Pooling**: Optimized with max/min pool sizes
- **Authentication**: Proper authentication source configuration

#### Configuration
```bash
# .env file
MONGODB_URI=mongodb://localhost:27017/ml-insights-hub
# OR for MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```

### 5. Rate Limiting

#### Global Rate Limiting
- **General API**: 100 requests per 15 minutes
- **ML Endpoints**: 50 requests per 15 minutes
- **Auth Endpoints**: 20 requests per 15 minutes
- **Upload Endpoints**: 10 requests per 15 minutes

#### Per-User Rate Limiting
Implemented in `mlAuth.js`:
- Tracks requests per authenticated user
- Configurable limits and windows
- Automatic cleanup of old entries

### 6. Security Headers

Implemented via Helmet.js:
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **X-XSS-Protection**: 1; mode=block
- **Strict-Transport-Security**: HSTS enabled
- **Content-Security-Policy**: Restrictive CSP
- **Referrer-Policy**: no-referrer

### 7. CORS Protection

```javascript
// Configured in server.js
cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
})
```

---

## 🛡️ Security Best Practices

### Environment Variables

#### Required Security Variables
```bash
# JWT Secret - CRITICAL!
# Generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64-character-hex-string>

# JWT Expiration
JWT_EXPIRE=7d

# Database Connection
MONGODB_URI=mongodb://localhost:27017/ml-insights-hub

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Optional: API Keys for service authentication
API_KEYS=key1,key2,key3
```

#### Security Scripts
```bash
# Generate secure JWT secret
npm run generate-jwt-secret

# Update JWT secret in .env file
npm run generate-jwt-secret --update-env

# Run security audit
npm run check-security

# Verify security configuration
npm run security-audit
```

### Production Deployment Checklist

- [ ] Generate strong JWT_SECRET (64+ hex characters)
- [ ] Set NODE_ENV=production
- [ ] Use HTTPS/TLS for all connections
- [ ] Configure MongoDB with authentication
- [ ] Enable MongoDB encryption at rest
- [ ] Set up firewall rules (allow only necessary ports)
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting in production mode
- [ ] Set up log monitoring and alerting
- [ ] Implement backup and disaster recovery
- [ ] Use environment-specific configuration files
- [ ] Enable audit logging for sensitive operations
- [ ] Configure API keys for external services
- [ ] Set up intrusion detection system (IDS)
- [ ] Implement automated security scanning
- [ ] Use secrets management service (e.g., AWS Secrets Manager, HashiCorp Vault)

---

## 🚨 Security Incident Response

### Detecting Security Violations

The application logs security incidents:

```javascript
console.error('🚨 SECURITY VIOLATION:', {
  type: error.type,
  timestamp: error.timestamp,
  userAgent: req.get('User-Agent'),
  ip: req.ip,
  userId: req.user?.id
});
```

### Common Security Errors

#### 1. Authentication Errors
```json
{
  "success": false,
  "error": "Invalid token",
  "type": "INVALID_TOKEN",
  "message": "The provided token is invalid or malformed"
}
```

#### 2. Python Security Violations
```json
{
  "success": false,
  "error": "Input validation failed",
  "type": "security_error",
  "details": {
    "securityViolation": "INPUT_VALIDATION",
    "timestamp": "2025-01-23T12:00:00Z"
  }
}
```

#### 3. Rate Limit Exceeded
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "type": "USER_RATE_LIMIT",
  "message": "You have exceeded the limit of 100 requests per 15 minutes",
  "resetAt": "2025-01-23T12:15:00Z"
}
```

---

## 🔍 Security Monitoring

### Log Files
- **Access Logs**: Combined format via Morgan
- **Error Logs**: Console error output with timestamps
- **Security Logs**: Dedicated security violation logging

### Metrics to Monitor
1. Failed authentication attempts
2. Rate limit violations
3. Python script execution failures
4. Database connection errors
5. Unusual API usage patterns
6. Input validation failures

### Recommended Tools
- **Log Aggregation**: ELK Stack, Splunk, Datadog
- **Security Monitoring**: OSSEC, Wazuh
- **Application Monitoring**: New Relic, AppDynamics
- **Network Monitoring**: Wireshark, tcpdump

---

## 📚 Security Testing

### Manual Testing

#### Test Authentication
```bash
# No token - should fail
curl -X POST http://localhost:5000/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"features": {}, "modelType": "random_forest"}'

# With valid token - should succeed
curl -X POST http://localhost:5000/api/ml/predict \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"features": {"bedrooms": 3}, "modelType": "random_forest"}'
```

#### Test Input Validation
```bash
# Malicious input - should be blocked
curl -X POST http://localhost:5000/api/ml/predict \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"features": {"evil": "import os; os.system(\"rm -rf /\")"}, "modelType": "random_forest"}'
```

### Automated Security Testing
```bash
# Run security audit
npm run security-audit

# Check for vulnerable dependencies
npm audit

# Fix vulnerabilities
npm audit fix
```

---

## 🔧 Security Configuration Files

### Key Files
- `server/middleware/security.js` - Security middleware configuration
- `server/middleware/mlAuth.js` - Authentication middleware
- `server/utils/securePythonBridge.js` - Secure Python execution
- `server/utils/securePythonExecutor.js` - Python sandboxing
- `server/python-scripts/input_validator.py` - Python input validation
- `server/utils/startupSecurity.js` - Startup security validation
- `server/.env.example` - Environment variable template

---

## 📞 Security Contacts

### Reporting Security Vulnerabilities
If you discover a security vulnerability:
1. **DO NOT** open a public GitHub issue
2. Email security concerns to: [security@yourdomain.com]
3. Include detailed steps to reproduce
4. Allow reasonable time for fixes before public disclosure

### Security Team
- Security Lead: [Name/Email]
- DevOps Team: [Contact Info]
- On-Call Engineer: [Contact Info]

---

## 📖 Additional Resources

### Security Standards
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework
- CWE/SANS Top 25: https://cwe.mitre.org/top25/

### Related Documentation
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Environment Configuration](./server/.env.example)

---

**Last Updated**: 2025-01-23
**Security Version**: 2.0
**Reviewed By**: ML Insights Hub Security Team
