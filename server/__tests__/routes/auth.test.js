/**
 * Tests for Authentication and Authorization Routes
 *
 * Tests cover:
 * - Registration with duplicate detection
 * - Login with password verification
 * - JWT token generation and validation
 * - Role-based access control
 * - Error handling scenarios
 * - Middleware authentication
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const authRoutes = require('../../routes/auth');
const { authMiddleware, adminMiddleware } = require('../../middleware/auth');
const { requireAuth, requireAdmin } = require('../../middleware/mlAuth');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Test protected routes
app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({ message: 'Protected route accessed', user: req.user });
});

app.get('/api/admin-only', authMiddleware, adminMiddleware, (req, res) => {
  res.json({ message: 'Admin route accessed', user: req.user });
});

app.get('/api/ml/protected', requireAuth, (req, res) => {
  res.json({ message: 'ML route accessed', user: req.user });
});

app.get('/api/ml/admin', requireAuth, requireAdmin, (req, res) => {
  res.json({ message: 'ML admin route accessed', user: req.user });
});

// Set JWT secret for tests
process.env.JWT_SECRET = 'test-secret-key-for-testing';

describe('Authentication Routes', () => {
  describe('POST /api/auth/register', () => {
    describe('Successful Registration', () => {
      it('should register a new user with valid data', async () => {
        const userData = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(200);

        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user.username).toBe(userData.username);
        expect(response.body.user.email).toBe(userData.email);
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user).toHaveProperty('role');
        expect(response.body.user.role).toBe('user'); // Default role
      });

      it('should return a valid JWT token on registration', async () => {
        const userData = {
          username: 'jwtuser',
          email: 'jwt@example.com',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(200);

        const { token } = response.body;
        expect(token).toBeDefined();

        // Verify token is valid
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        expect(decoded).toHaveProperty('id');
        expect(decoded).toHaveProperty('role');
      });

      it('should hash password before storing', async () => {
        const userData = {
          username: 'hashtest',
          email: 'hash@example.com',
          password: 'password123'
        };

        await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(200);

        const user = await User.findOne({ email: userData.email });
        expect(user.password).not.toBe(userData.password);
        expect(user.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash format
      });
    });

    describe('Duplicate Detection', () => {
      beforeEach(async () => {
        await User.create({
          username: 'existinguser',
          email: 'existing@example.com',
          password: 'password123'
        });
      });

      it('should reject registration with duplicate email', async () => {
        const userData = {
          username: 'newuser',
          email: 'existing@example.com',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('User already exists');
      });

      it('should reject registration with duplicate username', async () => {
        const userData = {
          username: 'existinguser',
          email: 'newemail@example.com',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('User already exists');
      });

      it('should reject registration with both duplicate email and username', async () => {
        const userData = {
          username: 'existinguser',
          email: 'existing@example.com',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body.error).toBe('User already exists');
      });
    });

    describe('Validation Errors', () => {
      it('should handle missing username', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(500);

        expect(response.body).toHaveProperty('error');
      });

      it('should handle missing email', async () => {
        const userData = {
          username: 'testuser',
          password: 'password123'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(500);

        expect(response.body).toHaveProperty('error');
      });

      it('should handle missing password', async () => {
        const userData = {
          username: 'testuser',
          email: 'test@example.com'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(500);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;
    const plainPassword = 'password123';

    beforeEach(async () => {
      testUser = await User.create({
        username: 'loginuser',
        email: 'login@example.com',
        password: plainPassword
      });
    });

    describe('Successful Login', () => {
      it('should login with valid credentials', async () => {
        const credentials = {
          email: 'login@example.com',
          password: plainPassword
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(200);

        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user.email).toBe(credentials.email);
        expect(response.body.user.username).toBe('loginuser');
      });

      it('should return valid JWT token on login', async () => {
        const credentials = {
          email: 'login@example.com',
          password: plainPassword
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(200);

        const { token } = response.body;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        expect(decoded.id).toBe(testUser._id.toString());
        expect(decoded.role).toBe(testUser.role);
      });

      it('should include user role in response', async () => {
        const credentials = {
          email: 'login@example.com',
          password: plainPassword
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(200);

        expect(response.body.user.role).toBeDefined();
        expect(response.body.user.role).toBe('user');
      });
    });

    describe('Password Verification', () => {
      it('should reject login with incorrect password', async () => {
        const credentials = {
          email: 'login@example.com',
          password: 'wrongpassword'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Invalid credentials');
      });

      it('should reject login with non-existent email', async () => {
        const credentials = {
          email: 'nonexistent@example.com',
          password: plainPassword
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);

        expect(response.body.error).toBe('Invalid credentials');
      });

      it('should be case-sensitive for password', async () => {
        const credentials = {
          email: 'login@example.com',
          password: 'PASSWORD123'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);

        expect(response.body.error).toBe('Invalid credentials');
      });

      it('should handle empty password', async () => {
        const credentials = {
          email: 'login@example.com',
          password: ''
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);

        expect(response.body.error).toBe('Invalid credentials');
      });
    });

    describe('Validation Errors', () => {
      it('should handle missing email', async () => {
        const credentials = {
          password: plainPassword
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });

      it('should handle missing password', async () => {
        const credentials = {
          email: 'login@example.com'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(500);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('JWT Token Validation', () => {
    let validToken;
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        username: 'tokenuser',
        email: 'token@example.com',
        password: 'password123'
      });

      validToken = jwt.sign(
        { id: testUser._id, role: testUser.role },
        process.env.JWT_SECRET
      );
    });

    describe('Valid Token Access', () => {
      it('should allow access to protected route with valid token', async () => {
        const response = await request(app)
          .get('/api/protected')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        expect(response.body.message).toBe('Protected route accessed');
        expect(response.body.user).toBeDefined();
        expect(response.body.user.id).toBe(testUser._id.toString());
      });

      it('should decode user information from token', async () => {
        const response = await request(app)
          .get('/api/protected')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        expect(response.body.user.id).toBe(testUser._id.toString());
        expect(response.body.user.role).toBe(testUser.role);
      });

      it('should work with ML auth middleware', async () => {
        const response = await request(app)
          .get('/api/ml/protected')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        expect(response.body.message).toBe('ML route accessed');
      });
    });

    describe('Invalid Token Handling', () => {
      it('should reject request without token', async () => {
        const response = await request(app)
          .get('/api/protected')
          .expect(401);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('No token, authorization denied');
      });

      it('should reject request with malformed token', async () => {
        const response = await request(app)
          .get('/api/protected')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Token is not valid');
      });

      it('should reject request with expired token', async () => {
        const expiredToken = jwt.sign(
          { id: testUser._id, role: testUser.role },
          process.env.JWT_SECRET,
          { expiresIn: '0s' }
        );

        // Wait for token to expire
        await new Promise(resolve => setTimeout(resolve, 100));

        const response = await request(app)
          .get('/api/protected')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body.error).toBe('Token is not valid');
      });

      it('should reject token with wrong secret', async () => {
        const wrongToken = jwt.sign(
          { id: testUser._id, role: testUser.role },
          'wrong-secret'
        );

        const response = await request(app)
          .get('/api/protected')
          .set('Authorization', `Bearer ${wrongToken}`)
          .expect(401);

        expect(response.body.error).toBe('Token is not valid');
      });

      it('should accept token if directly provided (legacy support)', async () => {
        // Note: authMiddleware uses .replace('Bearer ', '') which means
        // it will accept tokens with or without Bearer prefix
        const response = await request(app)
          .get('/api/protected')
          .set('Authorization', validToken)
          .expect(200);

        expect(response.body.message).toBe('Protected route accessed');
      });
    });
  });

  describe('Role-Based Access Control', () => {
    let userToken;
    let adminToken;
    let regularUser;
    let adminUser;

    beforeEach(async () => {
      regularUser = await User.create({
        username: 'regularuser',
        email: 'user@example.com',
        password: 'password123',
        role: 'user'
      });

      adminUser = await User.create({
        username: 'adminuser',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin'
      });

      userToken = jwt.sign(
        { id: regularUser._id, role: regularUser.role },
        process.env.JWT_SECRET
      );

      adminToken = jwt.sign(
        { id: adminUser._id, role: adminUser.role },
        process.env.JWT_SECRET
      );
    });

    describe('Admin Middleware', () => {
      it('should allow admin to access admin-only route', async () => {
        const response = await request(app)
          .get('/api/admin-only')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.message).toBe('Admin route accessed');
        expect(response.body.user.role).toBe('admin');
      });

      it('should deny regular user access to admin-only route', async () => {
        const response = await request(app)
          .get('/api/admin-only')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Admin access required');
      });

      it('should work with ML admin middleware', async () => {
        const response = await request(app)
          .get('/api/ml/admin')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.message).toBe('ML admin route accessed');
      });

      it('should deny regular user with ML admin middleware', async () => {
        const response = await request(app)
          .get('/api/ml/admin')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('error');
      });
    });

    describe('User Roles', () => {
      it('should allow data_scientist role access', async () => {
        const dataScientist = await User.create({
          username: 'scientist',
          email: 'scientist@example.com',
          password: 'password123',
          role: 'data_scientist'
        });

        const scientistToken = jwt.sign(
          { id: dataScientist._id, role: dataScientist.role },
          process.env.JWT_SECRET
        );

        const response = await request(app)
          .get('/api/protected')
          .set('Authorization', `Bearer ${scientistToken}`)
          .expect(200);

        expect(response.body.user.role).toBe('data_scientist');
      });

      it('should validate role in JWT payload', async () => {
        const response = await request(app)
          .get('/api/protected')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(200);

        expect(response.body.user.role).toBe('user');
      });
    });
  });

  describe('Error Handling', () => {
    describe('Server Errors', () => {
      it('should handle database errors gracefully during registration', async () => {
        // Mock User.findOne to throw error
        const originalFindOne = User.findOne;
        User.findOne = jest.fn().mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'errortest',
            email: 'error@example.com',
            password: 'password123'
          })
          .expect(500);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Database error');

        User.findOne = originalFindOne;
      });

      it('should handle database errors gracefully during login', async () => {
        const originalFindOne = User.findOne;
        User.findOne = jest.fn().mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'error@example.com',
            password: 'password123'
          })
          .expect(500);

        expect(response.body).toHaveProperty('error');

        User.findOne = originalFindOne;
      });
    });

    describe('Invalid Requests', () => {
      it('should handle empty request body for registration', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({})
          .expect(500);

        expect(response.body).toHaveProperty('error');
      });

      it('should handle empty request body for login', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({})
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });

      it('should handle malformed JSON', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .set('Content-Type', 'application/json')
          .send('invalid json')
          .expect(400);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should complete full registration and login flow', async () => {
      // Register
      const userData = {
        username: 'flowtest',
        email: 'flow@example.com',
        password: 'password123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(200);

      expect(registerResponse.body).toHaveProperty('token');

      // Login with same credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('token');
      expect(loginResponse.body.user.email).toBe(userData.email);

      // Access protected route
      const protectedResponse = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(200);

      expect(protectedResponse.body.message).toBe('Protected route accessed');
    });

    it('should maintain user session across requests with token', async () => {
      const user = await User.create({
        username: 'sessiontest',
        email: 'session@example.com',
        password: 'password123'
      });

      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET
      );

      // First request
      const response1 = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Second request with same token
      const response2 = await request(app)
        .get('/api/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response1.body.user.id).toBe(response2.body.user.id);
    });
  });
});
