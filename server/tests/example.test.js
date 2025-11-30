const mongoose = require('mongoose');

// Example test file demonstrating the Jest setup

describe('Example Test Suite', () => {
  describe('MongoDB Connection', () => {
    it('should connect to MongoDB Memory Server', () => {
      expect(mongoose.connection.readyState).toBe(1); // 1 = connected
    });

    it('should have access to test database URI', () => {
      expect(process.env.MONGODB_URI_TEST).toBeDefined();
      expect(process.env.MONGODB_URI_TEST).toContain('mongodb://');
    });
  });

  describe('Sample Tests', () => {
    it('should pass a basic test', () => {
      expect(true).toBe(true);
    });

    it('should perform async operations', async () => {
      const result = await Promise.resolve('success');
      expect(result).toBe('success');
    });
  });
});
