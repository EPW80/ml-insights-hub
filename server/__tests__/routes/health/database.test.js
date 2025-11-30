/**
 * Tests for Database Health Check Routes
 *
 * Tests cover:
 * - Health check endpoint
 * - Database statistics endpoint
 * - Performance testing endpoint
 * - Reconnection endpoint
 * - Connection state monitoring
 * - Error handling
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const healthRoutes = require('../../../routes/health/database');

// Setup Express app for testing
const app = express();
app.use(express.json());

// Mock database connection manager
const mockConnectionManager = {
  getHealthStatus: jest.fn(),
  getStats: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
};

// Set connection manager in app
app.set('dbConnectionManager', mockConnectionManager);

// Mount health routes
app.use('/api/health', healthRoutes);

describe('Database Health Check Routes', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Default mock implementations
    mockConnectionManager.getHealthStatus.mockReturnValue({
      status: 'healthy',
      state: 'connected',
      message: 'Database connection is healthy'
    });

    mockConnectionManager.getStats.mockReturnValue({
      connectionAttempts: 1,
      reconnections: 0,
      uptime: 1000,
      state: 'connected'
    });
  });

  describe('GET /api/health/database', () => {
    describe('Healthy Connection', () => {
      it('should return 200 for healthy database', async () => {
        const response = await request(app)
          .get('/api/health/database')
          .expect(200);

        expect(response.body.status).toBe('healthy');
      });

      it('should include health status from connection manager', async () => {
        const response = await request(app)
          .get('/api/health/database')
          .expect(200);

        expect(mockConnectionManager.getHealthStatus).toHaveBeenCalled();
        expect(response.body.state).toBe('connected');
        expect(response.body.message).toBe('Database connection is healthy');
      });

      it('should include connection statistics', async () => {
        const response = await request(app)
          .get('/api/health/database')
          .expect(200);

        expect(mockConnectionManager.getStats).toHaveBeenCalled();
        expect(response.body.metrics).toBeDefined();
        expect(response.body.metrics.connectionAttempts).toBe(1);
        expect(response.body.metrics.reconnections).toBe(0);
      });

      it('should include database metrics', async () => {
        const response = await request(app)
          .get('/api/health/database')
          .expect(200);

        expect(response.body.metrics).toBeDefined();
        expect(response.body.metrics.database).toBeDefined();
      });
    });

    describe('Unhealthy Connection', () => {
      it('should return 503 for unhealthy database', async () => {
        mockConnectionManager.getHealthStatus.mockReturnValue({
          status: 'unhealthy',
          state: 'disconnected',
          message: 'Database connection lost'
        });

        const response = await request(app)
          .get('/api/health/database')
          .expect(503);

        expect(response.body.status).toBe('unhealthy');
      });

      it('should include error details when unhealthy', async () => {
        mockConnectionManager.getHealthStatus.mockReturnValue({
          status: 'unhealthy',
          state: 'disconnected',
          message: 'Connection timeout',
          error: 'ETIMEDOUT'
        });

        const response = await request(app)
          .get('/api/health/database')
          .expect(503);

        expect(response.body.status).toBe('unhealthy');
        expect(response.body.message).toBe('Connection timeout');
      });
    });

    describe('Error Handling', () => {
      it('should handle missing connection manager', async () => {
        const appWithoutManager = express();
        appWithoutManager.use(express.json());
        appWithoutManager.use('/api/health', healthRoutes);

        const response = await request(appWithoutManager)
          .get('/api/health/database')
          .expect(500);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toBe('Database connection manager not available');
      });

      it('should handle connection manager errors', async () => {
        mockConnectionManager.getHealthStatus.mockImplementation(() => {
          throw new Error('Connection manager failed');
        });

        const response = await request(app)
          .get('/api/health/database')
          .expect(500);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toBe('Health check failed');
        expect(response.body.error).toBe('Connection manager failed');
      });

      it('should include timestamp in error response', async () => {
        mockConnectionManager.getHealthStatus.mockImplementation(() => {
          throw new Error('Test error');
        });

        const response = await request(app)
          .get('/api/health/database')
          .expect(500);

        expect(response.body.timestamp).toBeDefined();
        expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
      });
    });
  });

  describe('GET /api/health/database/stats', () => {
    describe('Successful Stats Retrieval', () => {
      it('should return connection statistics', async () => {
        const response = await request(app)
          .get('/api/health/database/stats')
          .expect(200);

        expect(response.body.connection).toBeDefined();
        expect(response.body.connection.connectionAttempts).toBe(1);
        expect(response.body.connection.reconnections).toBe(0);
      });

      it('should return database metrics', async () => {
        const response = await request(app)
          .get('/api/health/database/stats')
          .expect(200);

        expect(response.body.database).toBeDefined();
      });

      it('should include timestamp', async () => {
        const response = await request(app)
          .get('/api/health/database/stats')
          .expect(200);

        expect(response.body.timestamp).toBeDefined();
        expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
      });

      it('should call connection manager methods', async () => {
        await request(app)
          .get('/api/health/database/stats')
          .expect(200);

        expect(mockConnectionManager.getStats).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle missing connection manager', async () => {
        const appWithoutManager = express();
        appWithoutManager.use(express.json());
        appWithoutManager.use('/api/health', healthRoutes);

        const response = await request(appWithoutManager)
          .get('/api/health/database/stats')
          .expect(500);

        expect(response.body.error).toBe('Database connection manager not available');
      });

      it('should handle stats retrieval errors', async () => {
        mockConnectionManager.getStats.mockImplementation(() => {
          throw new Error('Stats unavailable');
        });

        const response = await request(app)
          .get('/api/health/database/stats')
          .expect(500);

        expect(response.body.error).toBe('Failed to retrieve database statistics');
        expect(response.body.message).toBe('Stats unavailable');
      });
    });
  });

  describe('GET /api/health/database/performance', () => {
    describe('Performance Testing', () => {
      it('should return performance metrics', async () => {
        const response = await request(app)
          .get('/api/health/database/performance')
          .expect(200);

        expect(response.body.status).toBe('success');
        expect(response.body.performance).toBeDefined();
      });

      it('should include ping response time', async () => {
        const response = await request(app)
          .get('/api/health/database/performance')
          .expect(200);

        expect(response.body.performance.pingResponseTime).toBeDefined();
        expect(response.body.performance.pingResponseTime).toMatch(/ms$/);
      });

      it('should include connection state', async () => {
        const response = await request(app)
          .get('/api/health/database/performance')
          .expect(200);

        expect(response.body.performance.connectionState).toBeDefined();
        expect(['connected', 'disconnected', 'connecting', 'disconnecting'])
          .toContain(response.body.performance.connectionState);
      });

      it('should include collection test when connected', async () => {
        // Ensure mongoose is in connected state
        if (mongoose.connection.readyState === 1) {
          const response = await request(app)
            .get('/api/health/database/performance')
            .expect(200);

          expect(response.body.performance.collections).toBeDefined();
          if (response.body.performance.collections) {
            expect(response.body.performance.collections.collectionsCount).toBeDefined();
            expect(response.body.performance.collections.queryTime).toBeDefined();
          }
        }
      });

      it('should include timestamp', async () => {
        const response = await request(app)
          .get('/api/health/database/performance')
          .expect(200);

        expect(response.body.timestamp).toBeDefined();
      });
    });

    describe('Error Handling', () => {
      it('should handle performance test failures', async () => {
        // Temporarily mock mongoose admin to throw error
        const originalAdmin = mongoose.connection.db?.admin;
        if (mongoose.connection.db) {
          mongoose.connection.db.admin = () => {
            throw new Error('Admin command failed');
          };
        }

        const response = await request(app)
          .get('/api/health/database/performance')
          .expect(500);

        expect(response.body.status).toBe('error');
        expect(response.body.error).toBe('Performance test failed');

        // Restore original admin
        if (mongoose.connection.db && originalAdmin) {
          mongoose.connection.db.admin = originalAdmin;
        }
      });
    });
  });

  describe('POST /api/health/database/reconnect', () => {
    describe('Successful Reconnection', () => {
      beforeEach(() => {
        mockConnectionManager.disconnect.mockResolvedValue();
        mockConnectionManager.connect.mockResolvedValue();
      });

      it('should trigger database reconnection', async () => {
        const response = await request(app)
          .post('/api/health/database/reconnect')
          .expect(200);

        expect(response.body.status).toBe('success');
        expect(response.body.message).toBe('Database reconnection initiated');
      });

      it('should disconnect before reconnecting', async () => {
        await request(app)
          .post('/api/health/database/reconnect')
          .expect(200);

        expect(mockConnectionManager.disconnect).toHaveBeenCalled();
        expect(mockConnectionManager.connect).toHaveBeenCalled();

        // Verify disconnect was called before connect
        const disconnectOrder = mockConnectionManager.disconnect.mock.invocationCallOrder[0];
        const connectOrder = mockConnectionManager.connect.mock.invocationCallOrder[0];
        expect(disconnectOrder).toBeLessThan(connectOrder);
      });

      it('should include timestamp in response', async () => {
        const response = await request(app)
          .post('/api/health/database/reconnect')
          .expect(200);

        expect(response.body.timestamp).toBeDefined();
      });
    });

    describe('Error Handling', () => {
      it('should handle missing connection manager', async () => {
        const appWithoutManager = express();
        appWithoutManager.use(express.json());
        appWithoutManager.use('/api/health', healthRoutes);

        const response = await request(appWithoutManager)
          .post('/api/health/database/reconnect')
          .expect(500);

        expect(response.body.error).toBe('Database connection manager not available');
      });

      it('should handle disconnect failures', async () => {
        mockConnectionManager.disconnect.mockRejectedValue(new Error('Disconnect failed'));

        const response = await request(app)
          .post('/api/health/database/reconnect')
          .expect(500);

        expect(response.body.status).toBe('error');
        expect(response.body.error).toBe('Reconnection failed');
      });

      it('should handle connect failures', async () => {
        mockConnectionManager.disconnect.mockResolvedValue();
        mockConnectionManager.connect.mockRejectedValue(new Error('Connect failed'));

        const response = await request(app)
          .post('/api/health/database/reconnect')
          .expect(500);

        expect(response.body.status).toBe('error');
        expect(response.body.message).toBe('Connect failed');
      });
    });
  });

  describe('Response Format Consistency', () => {
    it('should return JSON for all endpoints', async () => {
      const endpoints = [
        '/api/health/database',
        '/api/health/database/stats',
        '/api/health/database/performance'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.headers['content-type']).toMatch(/json/);
      }
    });

    it('should include appropriate status codes', async () => {
      // Healthy connection
      mockConnectionManager.getHealthStatus.mockReturnValue({
        status: 'healthy',
        state: 'connected'
      });
      await request(app).get('/api/health/database').expect(200);

      // Unhealthy connection
      mockConnectionManager.getHealthStatus.mockReturnValue({
        status: 'unhealthy',
        state: 'disconnected'
      });
      await request(app).get('/api/health/database').expect(503);

      // Error
      mockConnectionManager.getHealthStatus.mockImplementation(() => {
        throw new Error('Test error');
      });
      await request(app).get('/api/health/database').expect(500);
    });
  });

  describe('Connection State Monitoring', () => {
    it('should report connected state correctly', async () => {
      mockConnectionManager.getHealthStatus.mockReturnValue({
        status: 'healthy',
        state: 'connected',
        message: 'Connected to database'
      });

      const response = await request(app)
        .get('/api/health/database')
        .expect(200);

      expect(response.body.state).toBe('connected');
    });

    it('should report disconnected state correctly', async () => {
      mockConnectionManager.getHealthStatus.mockReturnValue({
        status: 'unhealthy',
        state: 'disconnected',
        message: 'Disconnected from database'
      });

      const response = await request(app)
        .get('/api/health/database')
        .expect(503);

      expect(response.body.state).toBe('disconnected');
    });

    it('should report connecting state correctly', async () => {
      mockConnectionManager.getHealthStatus.mockReturnValue({
        status: 'degraded',
        state: 'connecting',
        message: 'Connecting to database'
      });

      const response = await request(app)
        .get('/api/health/database')
        .expect(503);

      expect(response.body.state).toBe('connecting');
    });
  });
});
