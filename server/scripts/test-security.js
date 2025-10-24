#!/usr/bin/env node
/**
 * Security Testing Script
 * Tests authentication, input validation, and Python security
 */

const path = require('path');

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_testing_only_minimum_64_characters_required_here';
process.env.MONGODB_URI = 'mongodb://localhost:27017/ml-insights-test';

const jwt = require('jsonwebtoken');
const { SecurePythonExecutor, PythonSecurityError } = require('../utils/securePythonExecutor');

console.log('🔒 Security Testing Suite\n');
console.log('=' .repeat(60));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

function testAsync(name, fn) {
  return fn()
    .then(() => {
      console.log(`✅ PASS: ${name}`);
      passed++;
    })
    .catch((error) => {
      console.log(`❌ FAIL: ${name}`);
      console.log(`   Error: ${error.message}`);
      failed++;
    });
}

// Test 1: JWT Token Generation
console.log('\n📝 Testing JWT Token Generation...');
test('Generate valid JWT token', () => {
  const token = jwt.sign(
    { id: 'test123', email: 'test@example.com', role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  if (!token || token.split('.').length !== 3) {
    throw new Error('Invalid token format');
  }
});

test('Verify JWT token', () => {
  const token = jwt.sign(
    { id: 'test123', email: 'test@example.com' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  if (decoded.id !== 'test123') {
    throw new Error('Token verification failed');
  }
});

// Test 2: Input Validation (Python)
console.log('\n🐍 Testing Python Input Validation...');

// Note: These tests require the input_validator module to be loaded
// In a real test environment, you'd use a Python test runner
console.log('⚠️  Python validation tests require Python environment');
console.log('   Run: python3 server/python-scripts/input_validator.py');

// Test 3: Secure Python Executor
console.log('\n🔐 Testing Secure Python Executor...');

const executor = new SecurePythonExecutor();

test('Validate script path - valid script', () => {
  const testScriptPath = path.resolve(__dirname, '../python-scripts/test_connection.py');
  const result = executor.validateScriptPath(testScriptPath);

  if (!result.isValid) {
    throw new Error(`Expected valid, got: ${result.errors.join(', ')}`);
  }
});

test('Validate script path - invalid path traversal', () => {
  const result = executor.validateScriptPath('../../../etc/passwd');

  if (result.isValid) {
    throw new Error('Should reject path traversal');
  }

  if (!result.errors.some(e => e.includes('path traversal') || e.includes('directory'))) {
    throw new Error('Should detect path traversal');
  }
});

test('Validate script path - non-.py file', () => {
  const result = executor.validateScriptPath('/tmp/malicious.sh');

  if (result.isValid) {
    throw new Error('Should reject non-Python files');
  }
});

test('Sanitize input - valid JSON', () => {
  const input = { features: { bedrooms: 3, sqft: 1500 } };
  const result = executor.sanitizeInput(input);

  if (!result.isValid) {
    throw new Error(`Expected valid, got: ${result.errors.join(', ')}`);
  }
});

test('Sanitize input - blocked pattern detection', () => {
  const input = { malicious: 'import os; os.system("rm -rf /")' };
  const result = executor.sanitizeInput(input);

  if (result.isValid) {
    throw new Error('Should detect blocked patterns');
  }
});

test('Sanitize input - path traversal detection', () => {
  const input = { path: '../../../etc/passwd' };
  const result = executor.sanitizeInput(input);

  if (result.isValid) {
    throw new Error('Should detect path traversal');
  }
});

test('Sanitize input - size limit', () => {
  const largeString = 'x'.repeat(2 * 1024 * 1024); // 2MB
  const input = { data: largeString };
  const result = executor.sanitizeInput(input);

  if (result.isValid) {
    throw new Error('Should reject oversized input');
  }
});

// Test 4: Authentication Middleware
console.log('\n🔑 Testing Authentication Middleware...');

const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/mlAuth');

test('requireAuth - missing header', () => {
  const req = { header: () => null };
  const res = {
    status: (code) => {
      if (code !== 401) throw new Error('Expected 401 status');
      return { json: () => {} };
    }
  };

  requireAuth(req, res, () => {
    throw new Error('Should not call next()');
  });
});

test('requireAuth - invalid format', () => {
  const req = { header: () => 'InvalidFormat token123' };
  const res = {
    status: (code) => {
      if (code !== 401) throw new Error('Expected 401 status');
      return { json: () => {} };
    }
  };

  requireAuth(req, res, () => {
    throw new Error('Should not call next()');
  });
});

test('optionalAuth - no token provided', () => {
  const req = { header: () => null };
  let nextCalled = false;

  optionalAuth(req, {}, () => {
    nextCalled = true;
  });

  if (!nextCalled) {
    throw new Error('Should call next()');
  }

  if (req.user !== null) {
    throw new Error('User should be null');
  }
});

// Test 5: Security Configuration
console.log('\n⚙️  Testing Security Configuration...');

test('JWT_SECRET is configured', () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  if (process.env.JWT_SECRET === 'GENERATE_SECURE_SECRET_FOR_PRODUCTION_USE_CRYPTO_RANDOM_BYTES_64_HEX') {
    throw new Error('JWT_SECRET using placeholder value');
  }
});

test('JWT_SECRET minimum length', () => {
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET too short (minimum 32 characters recommended)');
  }
});

// Test 6: Rate Limiting
console.log('\n⏱️  Testing Rate Limiting...');

const { userRateLimiter } = require('../middleware/mlAuth');

test('userRateLimiter - within limit', () => {
  const limiter = userRateLimiter(5, 1000);
  const req = { user: { id: 'test123' } };
  let nextCalled = false;

  limiter(req, {}, () => {
    nextCalled = true;
  });

  if (!nextCalled) {
    throw new Error('Should allow request within limit');
  }
});

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results:`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);

if (failed === 0) {
  console.log('\n🎉 All security tests passed!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some security tests failed. Please review the errors above.');
  process.exit(1);
}
