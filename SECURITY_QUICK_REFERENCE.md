# Security Quick Reference Guide

## 🚀 Quick Start

### 1. Setup JWT Secret (REQUIRED)
```bash
# Generate secure secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Add to server/.env
JWT_SECRET=<paste-generated-secret-here>
```

### 2. Test Security
```bash
cd server
node scripts/test-security.js
```

### 3. Authenticate API Requests

**Using JWT Token**:
```bash
curl -X POST http://localhost:5000/api/ml/predict \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"features": {"bedrooms": 3, "sqft": 1500}, "modelType": "random_forest"}'
```

**Using API Key**:
```bash
curl -X POST http://localhost:5000/api/ml/predict \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"features": {"bedrooms": 3, "sqft": 1500}, "modelType": "random_forest"}'
```

---

## 🔐 Authentication Methods

### JWT Token (Recommended for Users)
```javascript
// Frontend example
const token = localStorage.getItem('token');
const response = await fetch('/api/ml/predict', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  method: 'POST',
  body: JSON.stringify({ features, modelType })
});
```

### API Key (For Services)
```javascript
const response = await fetch('/api/ml/predict', {
  headers: {
    'X-API-Key': process.env.API_KEY,
    'Content-Type': 'application/json'
  },
  method: 'POST',
  body: JSON.stringify({ features, modelType })
});
```

---

## 🛡️ Protected Endpoints

All ML endpoints require authentication:

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/ml/predict` | POST | ✅ Yes | Make predictions |
| `/api/ml/train` | POST | ✅ Yes | Train models |
| `/api/ml/analyze` | POST | ✅ Yes | Analyze data |
| `/api/ml/versions` | GET/POST | ✅ Yes | Model versioning |
| `/api/ml/ab-test` | POST | ✅ Yes | A/B testing |
| `/api/ml/auto-retrain` | POST | ✅ Yes | Auto-retraining |
| `/api/ml/explainability` | POST | ✅ Yes | Model explanations |
| `/api/auth/*` | * | ❌ No | Authentication endpoints |
| `/api/health/*` | GET | ❌ No | Health checks |

---

## 🔧 Environment Variables

```bash
# Required
JWT_SECRET=<64-character-hex-string>
MONGODB_URI=mongodb://localhost:27017/ml-insights-hub

# Optional
JWT_EXPIRE=7d
API_KEYS=key1,key2,key3
NODE_ENV=development|production
FRONTEND_URL=http://localhost:3000
```

---

## ⚠️ Common Errors

### 401 Unauthorized
```json
{
  "success": false,
  "error": "No token, authorization denied"
}
```
**Solution**: Add `Authorization: Bearer <token>` header

### 403 Forbidden
```json
{
  "success": false,
  "error": "Admin access required"
}
```
**Solution**: Use admin account or request admin privileges

### 429 Rate Limit
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "resetAt": "2025-01-23T12:15:00Z"
}
```
**Solution**: Wait until resetAt time or reduce request frequency

---

## 🧪 Testing

### Run Security Tests
```bash
cd server
node scripts/test-security.js
```

### Test Python Validation
```bash
cd server
python3 python-scripts/input_validator.py
```

### Manual API Test
```bash
# Should fail (no auth)
curl -X POST http://localhost:5000/api/ml/predict \
  -H "Content-Type: application/json" \
  -d '{"features": {"bedrooms": 3}, "modelType": "random_forest"}'

# Should succeed (with auth)
curl -X POST http://localhost:5000/api/ml/predict \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"features": {"bedrooms": 3}, "modelType": "random_forest"}'
```

---

## 📝 Quick Commands

```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Run security tests
npm run test:security  # or: node scripts/test-security.js

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Add auth to new ML route
# Edit route file and add:
# const { requireAuthOrApiKey } = require('../../middleware/mlAuth');
# router.use(requireAuthOrApiKey);
```

---

## 📚 Full Documentation

- **Complete Guide**: See `SECURITY.md`
- **Implementation Details**: See `SECURITY_ENHANCEMENTS_SUMMARY.md`
- **Environment Setup**: See `server/.env.example`

---

**Last Updated**: 2025-01-23
