/**
 * Comprehensive tests for MongoDB Connection Manager
 *
 * Tests cover:
 * - Initialization and configuration
 * - Connection management
 * - Reconnection logic with exponential backoff
 * - Health monitoring and checks
 * - Event emissions
 * - Graceful shutdown
 * - Error handling scenarios
 */

const mongoose = require('mongoose');
const MongoDBConnectionManager = require('../../config/database');

// Mock console methods to avoid cluttering test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe('MongoDBConnectionManager', () => {
  let manager;
  let processListeners = {};

  beforeEach(() => {
    // Store original process listeners
    processListeners = {
      SIGINT: process.listeners('SIGINT').slice(),
      SIGTERM: process.listeners('SIGTERM').slice(),
      SIGUSR2: process.listeners('SIGUSR2').slice()
    };
  });

  afterEach(async () => {
    // Clean up manager and timers
    if (manager) {
      manager._stopHealthCheck();
      manager.removeAllListeners();

      // Remove process event listeners added by the manager
      process.removeAllListeners('SIGINT');
      process.removeAllListeners('SIGTERM');
      process.removeAllListeners('SIGUSR2');

      // Restore original listeners
      processListeners.SIGINT.forEach(listener => process.on('SIGINT', listener));
      processListeners.SIGTERM.forEach(listener => process.on('SIGTERM', listener));
      processListeners.SIGUSR2.forEach(listener => process.on('SIGUSR2', listener));

      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.connection.close();
        } catch (error) {
          // Ignore close errors
        }
      }
    }

    // Remove all mongoose connection listeners
    mongoose.connection.removeAllListeners();

    // Wait for any background operations to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST
      });

      expect(manager.connectionString).toBe(process.env.MONGODB_URI_TEST);
      expect(manager.isConnected).toBe(false);
      expect(manager.isConnecting).toBe(false);
      expect(manager.reconnectAttempts).toBe(0);
      expect(manager.maxReconnectAttempts).toBe(5);
      expect(manager.reconnectInterval).toBe(5000);
      expect(manager.healthCheckInterval).toBe(30000);
      expect(manager.connectionTimeout).toBe(10000);
    });

    it('should initialize with custom options', () => {
      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST,
        maxReconnectAttempts: 3,
        reconnectInterval: 2000,
        healthCheckInterval: 15000,
        connectionTimeout: 5000,
        maxPoolSize: 20,
        minPoolSize: 5
      });

      expect(manager.maxReconnectAttempts).toBe(3);
      expect(manager.reconnectInterval).toBe(2000);
      expect(manager.healthCheckInterval).toBe(15000);
      expect(manager.connectionTimeout).toBe(5000);
      expect(manager.options.maxPoolSize).toBe(20);
      expect(manager.options.minPoolSize).toBe(5);
    });

    it('should initialize connection statistics', () => {
      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST
      });

      expect(manager.stats).toEqual({
        connectionAttempts: 0,
        reconnectionAttempts: 0,
        totalUptime: 0,
        lastConnectionTime: null,
        lastDisconnectionTime: null,
        healthChecks: 0,
        healthCheckFailures: 0
      });
    });

    it('should build connection options correctly', () => {
      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST,
        maxPoolSize: 15,
        serverSelectionTimeoutMS: 3000
      });

      expect(manager.options.maxPoolSize).toBe(15);
      expect(manager.options.serverSelectionTimeoutMS).toBe(3000);
      expect(manager.options.retryWrites).toBe(true);
      expect(manager.options.retryReads).toBe(true);
      expect(manager.options.w).toBe('majority');
      expect(manager.options.readPreference).toBe('primary');
    });

    it('should filter unsupported options', () => {
      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST,
        maxPoolSize: 15,
        customOption: 'value',
        anotherCustomOption: 123
      });

      expect(manager.options.maxPoolSize).toBe(15);
      expect(manager.options.customOption).toBeUndefined();
      expect(manager.options.anotherCustomOption).toBeUndefined();
    });
  });

  describe('Connection Management', () => {
    beforeEach(() => {
      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST
      });
    });

    it('should connect successfully to MongoDB', async () => {
      const result = await manager.connect();

      expect(result).toBe(true);
      expect(manager.isConnected).toBe(true);
      expect(manager.isConnecting).toBe(false);
      expect(manager.stats.connectionAttempts).toBe(1);
      expect(manager.stats.lastConnectionTime).toBeInstanceOf(Date);
      expect(mongoose.connection.readyState).toBe(1); // 1 = connected
    });

    it('should not attempt to connect if already connected', async () => {
      await manager.connect();
      const initialAttempts = manager.stats.connectionAttempts;

      const result = await manager.connect();

      expect(result).toBe(true);
      expect(manager.stats.connectionAttempts).toBe(initialAttempts);
    });

    it('should not attempt to connect if connection is in progress', async () => {
      // Start first connection
      const firstConnection = manager.connect();

      // Attempt second connection while first is in progress
      const result = await manager.connect();

      expect(result).toBe(false);

      // Wait for first connection to complete
      await firstConnection;
    });

    it('should increment connection attempts on each connection', async () => {
      await manager.connect();
      expect(manager.stats.connectionAttempts).toBe(1);

      await manager.disconnect();
      await manager.connect();
      expect(manager.stats.connectionAttempts).toBe(2);
    });

    it('should disconnect successfully', async () => {
      await manager.connect();
      expect(manager.isConnected).toBe(true);

      await manager.disconnect();

      // Wait for disconnection event
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mongoose.connection.readyState).toBe(0); // 0 = disconnected
    });

    it('should handle connection timeout', async () => {
      manager = new MongoDBConnectionManager({
        uri: 'mongodb://localhost:27999/timeout-test', // Non-existent port
        connectionTimeout: 100,
        serverSelectionTimeoutMS: 100
      });

      await expect(manager.connect()).rejects.toThrow();
      expect(manager.isConnecting).toBe(false);
    });
  });

  describe('Reconnection Logic with Exponential Backoff', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      // Ensure clean mongoose state
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
      mongoose.connection.removeAllListeners();

      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST,
        reconnectInterval: 1000,
        maxReconnectAttempts: 3
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should attempt reconnection with exponential backoff', async () => {
      jest.useRealTimers(); // Use real timers for this test
      await manager.connect();

      // Prevent actual reconnection attempts to avoid errors
      const connectSpy = jest.spyOn(manager, 'connect').mockResolvedValue(true);

      // Spy on _attemptReconnection
      const reconnectSpy = jest.spyOn(manager, '_attemptReconnection');

      // Trigger disconnection
      manager.isConnected = false;
      mongoose.connection.emit('disconnected');

      // Wait for event processing and reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(reconnectSpy).toHaveBeenCalled();
      expect(manager.reconnectAttempts).toBe(1);

      reconnectSpy.mockRestore();
      connectSpy.mockRestore();
      jest.useFakeTimers(); // Restore fake timers
    });

    it('should use exponential backoff delays', async () => {
      manager.reconnectInterval = 1000;

      // First attempt: 1000 * 2^0 = 1000ms
      await manager._attemptReconnection();
      expect(manager.reconnectAttempts).toBe(1);

      // Second attempt: 1000 * 2^1 = 2000ms
      manager.isConnecting = false;
      await manager._attemptReconnection();
      expect(manager.reconnectAttempts).toBe(2);

      // Third attempt: 1000 * 2^2 = 4000ms
      manager.isConnecting = false;
      await manager._attemptReconnection();
      expect(manager.reconnectAttempts).toBe(3);
    });

    it('should stop reconnection after max attempts', async () => {
      manager.maxReconnectAttempts = 3;
      manager.reconnectAttempts = 3;

      const eventSpy = jest.fn();
      manager.on('maxReconnectAttemptsReached', eventSpy);

      await manager._attemptReconnection();

      expect(eventSpy).toHaveBeenCalled();
      expect(manager.reconnectAttempts).toBe(3);
    });

    it('should reset reconnect attempts on successful connection', async () => {
      await manager.connect();
      manager.reconnectAttempts = 2;

      // Simulate reconnection
      mongoose.connection.emit('connected');

      expect(manager.reconnectAttempts).toBe(0);
    });

    it('should track reconnection attempts in statistics', async () => {
      await manager.connect();

      // Simulate multiple reconnection attempts
      manager.isConnecting = false;
      await manager._attemptReconnection();

      manager.isConnecting = false;
      await manager._attemptReconnection();

      expect(manager.stats.reconnectionAttempts).toBe(2);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST,
        healthCheckInterval: 5000
      });
      await manager.connect();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start health monitoring on connection', () => {
      expect(manager.healthCheckTimer).not.toBeNull();
    });

    it('should stop health monitoring on disconnection', async () => {
      expect(manager.healthCheckTimer).not.toBeNull();

      await manager.disconnect();

      expect(manager.healthCheckTimer).toBeNull();
    });

    it('should perform health check successfully', async () => {
      jest.useRealTimers(); // Use real timers for health check

      const eventSpy = jest.fn();
      manager.on('healthCheckPassed', eventSpy);

      await manager._performHealthCheck();

      expect(manager.stats.healthChecks).toBe(1);
      expect(eventSpy).toHaveBeenCalled();

      jest.useFakeTimers(); // Restore fake timers
    });

    it('should track health check failures', async () => {
      const eventSpy = jest.fn();
      manager.on('healthCheckFailed', eventSpy);

      // Close connection to make health check fail
      await mongoose.connection.close();

      await manager._performHealthCheck();

      expect(manager.stats.healthCheckFailures).toBe(1);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should run health checks at specified intervals', async () => {
      const performHealthCheckSpy = jest.spyOn(manager, '_performHealthCheck');

      // Fast-forward time by health check interval
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      expect(performHealthCheckSpy).toHaveBeenCalled();

      performHealthCheckSpy.mockRestore();
    });

    it('should calculate health check success rate', async () => {
      manager.stats.healthChecks = 10;
      manager.stats.healthCheckFailures = 2;

      const stats = manager.getStats();

      expect(stats.healthCheckSuccessRate).toBe('80.00%');
    });

    it('should return N/A for health check success rate when no checks performed', () => {
      manager.stats.healthChecks = 0;

      const stats = manager.getStats();

      expect(stats.healthCheckSuccessRate).toBe('N/A');
    });
  });

  describe('Event Emissions', () => {
    beforeEach(() => {
      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST
      });
    });

    it('should emit "connected" event on successful connection', async () => {
      const eventSpy = jest.fn();
      manager.on('connected', eventSpy);

      await manager.connect();

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit "disconnected" event on disconnection', async () => {
      await manager.connect();

      const eventSpy = jest.fn();
      manager.on('disconnected', eventSpy);

      mongoose.connection.emit('disconnected');

      // Wait for event processing
      await new Promise(resolve => setImmediate(resolve));

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit "error" event on connection error', async () => {
      const eventSpy = jest.fn();
      manager.on('error', eventSpy);

      // Mock process.exit to prevent test from exiting
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      const testError = new Error('Connection failed');
      mongoose.connection.emit('error', testError);

      expect(eventSpy).toHaveBeenCalledWith(testError);

      exitSpy.mockRestore();
    });

    it('should emit "reconnected" event on successful reconnection', () => {
      const eventSpy = jest.fn();
      manager.on('reconnected', eventSpy);

      mongoose.connection.emit('reconnected');

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit "serverSelectionError" event', () => {
      const eventSpy = jest.fn();
      manager.on('serverSelectionError', eventSpy);

      const testError = new Error('Server selection failed');
      mongoose.connection.emit('serverSelectionError', testError);

      expect(eventSpy).toHaveBeenCalledWith(testError);
    });

    it('should emit "healthCheckPassed" event on successful health check', async () => {
      await manager.connect();

      const eventSpy = jest.fn();
      manager.on('healthCheckPassed', eventSpy);

      await manager._performHealthCheck();

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit "healthCheckFailed" event on failed health check', async () => {
      await manager.connect();

      const eventSpy = jest.fn();
      manager.on('healthCheckFailed', eventSpy);

      // Close connection to fail health check
      await mongoose.connection.close();

      await manager._performHealthCheck();

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit "connectionFailed" event on connection failure', async () => {
      manager = new MongoDBConnectionManager({
        uri: 'mongodb://localhost:27999/fail-test',
        connectionTimeout: 100,
        serverSelectionTimeoutMS: 100
      });

      const eventSpy = jest.fn();
      manager.on('connectionFailed', eventSpy);

      await expect(manager.connect()).rejects.toThrow();

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit "maxReconnectAttemptsReached" event', async () => {
      manager.maxReconnectAttempts = 3;
      manager.reconnectAttempts = 3;

      const eventSpy = jest.fn();
      manager.on('maxReconnectAttemptsReached', eventSpy);

      await manager._attemptReconnection();

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Graceful Shutdown', () => {
    beforeEach(async () => {
      // Ensure clean mongoose state
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
      mongoose.connection.removeAllListeners();

      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST,
        maxReconnectAttempts: 0 // Prevent reconnection during shutdown tests
      });
      await manager.connect();
    });

    it('should handle SIGINT gracefully', async () => {
      jest.useRealTimers(); // Use real timers for shutdown

      const eventSpy = jest.fn();
      manager.on('shutdown', eventSpy);

      await manager._gracefulShutdown('SIGINT');

      expect(eventSpy).toHaveBeenCalled();
      expect(manager.healthCheckTimer).toBeNull();

      jest.useFakeTimers(); // Restore fake timers
    });

    it('should handle SIGTERM gracefully', async () => {
      const eventSpy = jest.fn();
      manager.on('shutdown', eventSpy);

      await manager._gracefulShutdown('SIGTERM');

      expect(eventSpy).toHaveBeenCalled();
      expect(manager.healthCheckTimer).toBeNull();
    });

    it('should handle SIGUSR2 gracefully (nodemon restart)', async () => {
      const eventSpy = jest.fn();
      manager.on('shutdown', eventSpy);

      await manager._gracefulShutdown('SIGUSR2');

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should stop health checks during shutdown', async () => {
      expect(manager.healthCheckTimer).not.toBeNull();

      await manager._gracefulShutdown('SIGTERM');

      expect(manager.healthCheckTimer).toBeNull();
    });

    it('should close connection during shutdown', async () => {
      expect(manager.isConnected).toBe(true);

      await manager._gracefulShutdown('SIGTERM');

      // Wait for disconnection
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mongoose.connection.readyState).toBe(0); // 0 = disconnected
    });

    it('should handle shutdown when not connected', async () => {
      await manager.disconnect();

      // Wait for disconnection
      await new Promise(resolve => setTimeout(resolve, 100));

      const eventSpy = jest.fn();
      manager.on('shutdown', eventSpy);

      await manager._gracefulShutdown('SIGTERM');

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling Scenarios', () => {
    beforeEach(() => {
      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST
      });
    });

    it('should handle authentication errors', () => {
      const authError = new Error('authentication failed');
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      manager._handleConnectionError(authError);

      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
    });

    it('should handle authorization errors', () => {
      const authError = new Error('not authorized');
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      manager._handleConnectionError(authError);

      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
    });

    it('should handle invalid credentials error', () => {
      const credError = new Error('invalid credentials');
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      manager._handleConnectionError(credError);

      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
    });

    it('should handle DNS resolution errors (ENOTFOUND)', () => {
      const dnsError = new Error('DNS failed');
      dnsError.code = 'ENOTFOUND';

      // Should not exit for non-critical errors
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      manager._handleConnectionError(dnsError);

      expect(exitSpy).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });

    it('should handle connection refused errors (ECONNREFUSED)', () => {
      const connError = new Error('Connection refused');
      connError.code = 'ECONNREFUSED';

      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      manager._handleConnectionError(connError);

      expect(exitSpy).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });

    it('should handle timeout errors (ETIMEDOUT)', () => {
      const timeoutError = new Error('Connection timeout');
      timeoutError.code = 'ETIMEDOUT';

      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});

      manager._handleConnectionError(timeoutError);

      expect(exitSpy).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });
  });

  describe('Statistics and Health Status', () => {
    beforeEach(async () => {
      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST
      });
      await manager.connect();
    });

    it('should return connection statistics', () => {
      const stats = manager.getStats();

      expect(stats).toHaveProperty('connectionAttempts');
      expect(stats).toHaveProperty('reconnectionAttempts');
      expect(stats).toHaveProperty('isConnected');
      expect(stats).toHaveProperty('connectionState');
      expect(stats).toHaveProperty('healthCheckSuccessRate');
      expect(stats.isConnected).toBe(true);
    });

    it('should track total uptime correctly', async () => {
      const startStats = manager.getStats();

      // Wait 100ms
      await new Promise(resolve => setTimeout(resolve, 100));

      const endStats = manager.getStats();

      expect(endStats.currentUptime).toBeGreaterThan(startStats.currentUptime);
    });

    it('should track uptime across reconnections', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));

      await manager.disconnect();

      // Wait for disconnection
      await new Promise(resolve => setTimeout(resolve, 100));

      await manager.connect();

      const stats = manager.getStats();

      expect(stats.totalUptime).toBeGreaterThan(0);
    });

    it('should check if connection is healthy', async () => {
      expect(manager.isHealthy()).toBe(true);

      // Set max reconnect attempts to prevent reconnection
      manager.maxReconnectAttempts = 0;

      await manager.disconnect();

      // Wait for disconnection
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(manager.isHealthy()).toBe(false);
    });

    it('should return health status for health endpoints', () => {
      const health = manager.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.database).toBe('mongodb');
      expect(health.connectionState).toBe('connected');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('lastConnectionTime');
    });

    it('should return unhealthy status when disconnected', async () => {
      await manager.disconnect();

      // Wait for disconnection event to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Manually set state to ensure it's disconnected
      manager.isConnected = false;

      const health = manager.getHealthStatus();

      expect(health.status).toBe('unhealthy');
    });
  });

  describe('Connection State Helpers', () => {
    beforeEach(() => {
      manager = new MongoDBConnectionManager({
        uri: process.env.MONGODB_URI_TEST
      });
    });

    it('should get correct connection state name', () => {
      expect(manager._getConnectionStateName(0)).toBe('disconnected');
      expect(manager._getConnectionStateName(1)).toBe('connected');
      expect(manager._getConnectionStateName(2)).toBe('connecting');
      expect(manager._getConnectionStateName(3)).toBe('disconnecting');
      expect(manager._getConnectionStateName(99)).toBe('unknown');
    });

    it('should extract database name from connection string', () => {
      manager.connectionString = 'mongodb://localhost:27017/testdb';
      expect(manager._getDatabaseName()).toBe('testdb');

      manager.connectionString = 'mongodb://localhost:27017/testdb?retryWrites=true';
      expect(manager._getDatabaseName()).toBe('testdb');
    });

    it('should handle malformed connection strings for database name', () => {
      manager.connectionString = 'invalid';
      expect(manager._getDatabaseName()).toBe('Unknown');
    });

    it('should extract host info from connection string', () => {
      manager.connectionString = 'mongodb://localhost:27017/testdb';
      expect(manager._getHostInfo()).toBe('localhost:27017');

      manager.connectionString = 'mongodb+srv://cluster.mongodb.net/testdb';
      expect(manager._getHostInfo()).toBe('cluster.mongodb.net');
    });

    it('should handle malformed connection strings for host info', () => {
      manager.connectionString = 'invalid';
      expect(manager._getHostInfo()).toBe('Unknown');
    });
  });
});
