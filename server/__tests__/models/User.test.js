/**
 * Tests for User model
 *
 * Validates:
 * - Schema constraints and required fields
 * - Unique indexes (username, email)
 * - Enum validation (role)
 * - Password hashing middleware
 * - comparePassword method
 * - Default values
 * - Timestamps
 */

const mongoose = require('mongoose');
const User = require('../../models/User');

describe('User Model', () => {
  describe('Schema Validation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.username).toBe(userData.username);
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.password).not.toBe(userData.password); // Should be hashed
      expect(savedUser.role).toBe('user'); // Default value
    });

    it('should require username field', async () => {
      const user = new User({
        email: 'test@example.com',
        password: 'password123'
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should require email field', async () => {
      const user = new User({
        username: 'testuser',
        password: 'password123'
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should require password field', async () => {
      const user = new User({
        username: 'testuser',
        email: 'test@example.com'
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should trim whitespace from username', async () => {
      const user = new User({
        username: '  testuser  ',
        email: 'test@example.com',
        password: 'password123'
      });

      const savedUser = await user.save();
      expect(savedUser.username).toBe('testuser');
    });

    it('should convert email to lowercase', async () => {
      const user = new User({
        username: 'testuser',
        email: 'TEST@EXAMPLE.COM',
        password: 'password123'
      });

      const savedUser = await user.save();
      expect(savedUser.email).toBe('test@example.com');
    });
  });

  describe('Unique Constraints', () => {
    beforeEach(async () => {
      await User.create({
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123'
      });
    });

    it('should enforce unique username constraint', async () => {
      const duplicateUser = new User({
        username: 'existinguser',
        email: 'different@example.com',
        password: 'password123'
      });

      await expect(duplicateUser.save()).rejects.toThrow();
    });

    it('should enforce unique email constraint', async () => {
      const duplicateUser = new User({
        username: 'differentuser',
        email: 'existing@example.com',
        password: 'password123'
      });

      await expect(duplicateUser.save()).rejects.toThrow();
    });
  });

  describe('Enum Validation', () => {
    it('should accept valid role: user', async () => {
      const user = new User({
        username: 'testuser1',
        email: 'test1@example.com',
        password: 'password123',
        role: 'user'
      });

      const savedUser = await user.save();
      expect(savedUser.role).toBe('user');
    });

    it('should accept valid role: admin', async () => {
      const user = new User({
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'password123',
        role: 'admin'
      });

      const savedUser = await user.save();
      expect(savedUser.role).toBe('admin');
    });

    it('should accept valid role: data_scientist', async () => {
      const user = new User({
        username: 'testuser3',
        email: 'test3@example.com',
        password: 'password123',
        role: 'data_scientist'
      });

      const savedUser = await user.save();
      expect(savedUser.role).toBe('data_scientist');
    });

    it('should reject invalid role', async () => {
      const user = new User({
        username: 'testuser4',
        email: 'test4@example.com',
        password: 'password123',
        role: 'superadmin'
      });

      await expect(user.save()).rejects.toThrow();
    });

    it('should use default role when not specified', async () => {
      const user = new User({
        username: 'testuser5',
        email: 'test5@example.com',
        password: 'password123'
      });

      const savedUser = await user.save();
      expect(savedUser.role).toBe('user');
    });
  });

  describe('Password Hashing Middleware', () => {
    it('should hash password on save', async () => {
      const plainPassword = 'password123';
      const user = new User({
        username: 'hashtest',
        email: 'hash@example.com',
        password: plainPassword
      });

      const savedUser = await user.save();

      expect(savedUser.password).toBeDefined();
      expect(savedUser.password).not.toBe(plainPassword);
      expect(savedUser.password.length).toBeGreaterThan(plainPassword.length);
      expect(savedUser.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash format
    });

    it('should not rehash password if not modified', async () => {
      const user = await User.create({
        username: 'nohashtest',
        email: 'nohash@example.com',
        password: 'password123'
      });

      const originalHash = user.password;

      // Update a different field
      user.username = 'nohashtest_updated';
      await user.save();

      expect(user.password).toBe(originalHash);
    });

    it('should hash password when password is modified', async () => {
      const user = await User.create({
        username: 'rehashtest',
        email: 'rehash@example.com',
        password: 'password123'
      });

      const originalHash = user.password;

      // Update password
      user.password = 'newpassword456';
      await user.save();

      expect(user.password).not.toBe(originalHash);
      expect(user.password).toMatch(/^\$2[ayb]\$.{56}$/);
    });
  });

  describe('comparePassword Method', () => {
    let user;
    const plainPassword = 'password123';

    beforeEach(async () => {
      user = await User.create({
        username: 'comparetest',
        email: 'compare@example.com',
        password: plainPassword
      });
    });

    it('should return true for correct password', async () => {
      const isMatch = await user.comparePassword(plainPassword);
      expect(isMatch).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const isMatch = await user.comparePassword('wrongpassword');
      expect(isMatch).toBe(false);
    });

    it('should be case sensitive', async () => {
      const isMatch = await user.comparePassword('PASSWORD123');
      expect(isMatch).toBe(false);
    });

    it('should handle empty password', async () => {
      const isMatch = await user.comparePassword('');
      expect(isMatch).toBe(false);
    });
  });

  describe('Profile Fields', () => {
    it('should store profile information', async () => {
      const user = await User.create({
        username: 'profiletest',
        email: 'profile@example.com',
        password: 'password123',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          organization: 'Test Corp',
          phone: '123-456-7890'
        }
      });

      expect(user.profile.firstName).toBe('John');
      expect(user.profile.lastName).toBe('Doe');
      expect(user.profile.organization).toBe('Test Corp');
      expect(user.profile.phone).toBe('123-456-7890');
    });

    it('should allow optional profile fields', async () => {
      const user = await User.create({
        username: 'noprofile',
        email: 'noprofile@example.com',
        password: 'password123'
      });

      expect(user.profile).toBeDefined();
    });
  });

  describe('Usage Statistics', () => {
    it('should initialize usage stats with default values', async () => {
      const user = await User.create({
        username: 'statstest',
        email: 'stats@example.com',
        password: 'password123'
      });

      expect(user.usage_stats.predictions_made).toBe(0);
      expect(user.usage_stats.models_trained).toBe(0);
    });

    it('should track predictions_made', async () => {
      const user = await User.create({
        username: 'predstats',
        email: 'predstats@example.com',
        password: 'password123',
        usage_stats: {
          predictions_made: 10,
          models_trained: 0
        }
      });

      expect(user.usage_stats.predictions_made).toBe(10);
    });

    it('should track models_trained', async () => {
      const user = await User.create({
        username: 'modelstats',
        email: 'modelstats@example.com',
        password: 'password123',
        usage_stats: {
          predictions_made: 0,
          models_trained: 5
        }
      });

      expect(user.usage_stats.models_trained).toBe(5);
    });

    it('should track last_active timestamp', async () => {
      const now = new Date();
      const user = await User.create({
        username: 'activestats',
        email: 'activestats@example.com',
        password: 'password123',
        usage_stats: {
          last_active: now
        }
      });

      expect(user.usage_stats.last_active).toEqual(now);
    });
  });

  describe('API Key', () => {
    it('should allow storing API key', async () => {
      const user = await User.create({
        username: 'apikeytest',
        email: 'apikey@example.com',
        password: 'password123',
        api_key: 'test-api-key-12345'
      });

      expect(user.api_key).toBe('test-api-key-12345');
    });

    it('should allow undefined API key', async () => {
      const user = await User.create({
        username: 'noapikey',
        email: 'noapikey@example.com',
        password: 'password123'
      });

      expect(user.api_key).toBeUndefined();
    });
  });

  describe('Preferences', () => {
    it('should store user preferences', async () => {
      const user = await User.create({
        username: 'preftest',
        email: 'pref@example.com',
        password: 'password123',
        preferences: {
          default_model: 'linear_regression',
          notification_settings: {
            email: true,
            push: false
          }
        }
      });

      expect(user.preferences.default_model).toBe('linear_regression');
      expect(user.preferences.notification_settings.email).toBe(true);
      expect(user.preferences.notification_settings.push).toBe(false);
    });
  });

  describe('Timestamps', () => {
    it('should automatically add createdAt timestamp', async () => {
      const user = await User.create({
        username: 'timestamptest',
        email: 'timestamp@example.com',
        password: 'password123'
      });

      expect(user.createdAt).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should automatically add updatedAt timestamp', async () => {
      const user = await User.create({
        username: 'updatetest',
        email: 'update@example.com',
        password: 'password123'
      });

      expect(user.updatedAt).toBeDefined();
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt on modification', async () => {
      const user = await User.create({
        username: 'modifytest',
        email: 'modify@example.com',
        password: 'password123'
      });

      const originalUpdatedAt = user.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      user.username = 'modifytest_updated';
      await user.save();

      expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
