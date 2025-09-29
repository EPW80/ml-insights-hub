/**
 * Enhanced MongoDB Connection Manager
 * 
 * Provides comprehensive database connection handling with:
 * - Robust error handling and recovery
 * - Connection health monitoring
 * - Automatic reconnection with exponential backoff
 * - Connection pooling optimization
 * - Event-driven architecture
 * - Production-ready configuration
 */

const mongoose = require('mongoose');
const EventEmitter = require('events');

class MongoDBConnectionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.connectionString = options.uri || process.env.MONGODB_URI;
    this.options = this._buildConnectionOptions(options);
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectInterval = options.reconnectInterval || 5000; // 5 seconds
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30 seconds
    this.connectionTimeout = options.connectionTimeout || 10000; // 10 seconds
    
    // Connection statistics
    this.stats = {
      connectionAttempts: 0,
      reconnectionAttempts: 0,
      totalUptime: 0,
      lastConnectionTime: null,
      lastDisconnectionTime: null,
      healthChecks: 0,
      healthCheckFailures: 0
    };
    
    // Health check timer
    this.healthCheckTimer = null;
    this.connectionStartTime = null;
    
    this._setupEventHandlers();
  }

  /**
   * Build comprehensive connection options
   */
  _buildConnectionOptions(userOptions = {}) {
    const defaultOptions = {
      // Connection pool settings
      maxPoolSize: userOptions.maxPoolSize || 10,
      minPoolSize: userOptions.minPoolSize || 2,
      
      // Timeout settings
      serverSelectionTimeoutMS: userOptions.serverSelectionTimeoutMS || 5000,
      socketTimeoutMS: userOptions.socketTimeoutMS || 45000,
      connectTimeoutMS: userOptions.connectTimeoutMS || 10000,
      
      // Retry and buffering
      maxIdleTimeMS: userOptions.maxIdleTimeMS || 30000,
      waitQueueTimeoutMS: userOptions.waitQueueTimeoutMS || 2000,
      
      // Production settings
      retryWrites: true,
      retryReads: true,
      w: userOptions.w || 'majority',
      readPreference: userOptions.readPreference || 'primary',
      readConcern: { level: userOptions.readConcernLevel || 'majority' },
      
      // Monitoring
      heartbeatFrequencyMS: userOptions.heartbeatFrequencyMS || 10000,
      
      // Security
      authSource: userOptions.authSource || 'admin',
      
      // Additional options
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    // Filter out custom options that aren't for mongoose
    const filteredUserOptions = {};
    const supportedOptions = [
      'maxPoolSize', 'minPoolSize', 'serverSelectionTimeoutMS', 'socketTimeoutMS',
      'connectTimeoutMS', 'maxIdleTimeMS', 'waitQueueTimeoutMS', 'retryWrites',
      'retryReads', 'w', 'readPreference', 'readConcern', 'heartbeatFrequencyMS',
      'authSource', 'useNewUrlParser', 'useUnifiedTopology'
    ];

    Object.keys(userOptions).forEach(key => {
      if (supportedOptions.includes(key)) {
        filteredUserOptions[key] = userOptions[key];
      }
    });

    return { ...defaultOptions, ...filteredUserOptions };
  }

  /**
   * Setup comprehensive event handlers for MongoDB connection
   */
  _setupEventHandlers() {
    // Connection successful
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.connectionStartTime = new Date();
      this.stats.lastConnectionTime = new Date();
      
      console.log(`✅ [${new Date().toISOString()}] MongoDB connected successfully`);
      console.log(`📊 Connection pool size: ${this.options.maxPoolSize}`);
      console.log(`🔗 Database: ${this._getDatabaseName()}`);
      
      this.emit('connected');
      this._startHealthCheck();
    });

    // Connection error during initial connection
    mongoose.connection.on('error', (error) => {
      console.error(`❌ [${new Date().toISOString()}] MongoDB connection error:`, {
        error: error.message,
        code: error.code,
        codeName: error.codeName,
        connectionAttempt: this.stats.connectionAttempts
      });
      
      this.emit('error', error);
      this._handleConnectionError(error);
    });

    // Connection lost
    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      this.stats.lastDisconnectionTime = new Date();
      
      if (this.connectionStartTime) {
        this.stats.totalUptime += new Date() - this.connectionStartTime;
        this.connectionStartTime = null;
      }
      
      console.warn(`⚠️  [${new Date().toISOString()}] MongoDB disconnected`);
      this.emit('disconnected');
      this._stopHealthCheck();
      
      // Attempt reconnection if not intentionally disconnected
      if (!this.isConnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
        this._attemptReconnection();
      }
    });

    // Reconnection successful
    mongoose.connection.on('reconnected', () => {
      console.log(`🔄 [${new Date().toISOString()}] MongoDB reconnected successfully`);
      this.emit('reconnected');
    });

    // MongoDB server selection error
    mongoose.connection.on('serverSelectionError', (error) => {
      console.error(`🚨 [${new Date().toISOString()}] MongoDB server selection error:`, error.message);
      this.emit('serverSelectionError', error);
    });

    // Process termination handlers
    process.on('SIGINT', () => this._gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this._gracefulShutdown('SIGTERM'));
    process.on('SIGUSR2', () => this._gracefulShutdown('SIGUSR2')); // nodemon restart
  }

  /**
   * Connect to MongoDB with comprehensive error handling
   */
  async connect() {
    if (this.isConnected) {
      console.log('📝 MongoDB already connected');
      return true;
    }

    if (this.isConnecting) {
      console.log('📝 Connection attempt already in progress');
      return false;
    }

    this.isConnecting = true;
    this.stats.connectionAttempts++;

    try {
      console.log(`🔌 [${new Date().toISOString()}] Attempting MongoDB connection...`);
      console.log(`🏠 Host: ${this._getHostInfo()}`);
      console.log(`⚙️  Options: Pool(${this.options.maxPoolSize}), Timeout(${this.options.serverSelectionTimeoutMS}ms)`);

      // Connect with timeout
      await Promise.race([
        mongoose.connect(this.connectionString, this.options),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout)
        )
      ]);

      return true;

    } catch (error) {
      this.isConnecting = false;
      console.error(`💥 [${new Date().toISOString()}] MongoDB connection failed:`, {
        error: error.message,
        attempt: this.stats.connectionAttempts,
        willRetry: this.reconnectAttempts < this.maxReconnectAttempts
      });

      this.emit('connectionFailed', error);
      throw error;
    }
  }

  /**
   * Handle connection errors with appropriate recovery
   */
  _handleConnectionError(error) {
    // Critical errors that should stop the application
    const criticalErrors = [
      'authentication failed',
      'not authorized',
      'invalid credentials',
      'access denied'
    ];

    const isCritical = criticalErrors.some(criticalError => 
      error.message.toLowerCase().includes(criticalError)
    );

    if (isCritical) {
      console.error(`🛑 [${new Date().toISOString()}] Critical MongoDB error - stopping application`);
      process.exit(1);
    }

    // Handle specific error types
    if (error.code === 'ENOTFOUND') {
      console.error('🌐 DNS resolution failed - check MongoDB host');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🚫 Connection refused - check if MongoDB is running');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('⏰ Connection timeout - check network connectivity');
    }
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  async _attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`🛑 [${new Date().toISOString()}] Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    this.stats.reconnectionAttempts++;

    // Exponential backoff: 5s, 10s, 20s, 40s, 80s
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 [${new Date().toISOString()}] Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error.message);
        // The disconnected event will trigger another reconnection attempt
      }
    }, delay);
  }

  /**
   * Start health check monitoring
   */
  _startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this._performHealthCheck();
    }, this.healthCheckInterval);

    console.log(`💓 [${new Date().toISOString()}] MongoDB health monitoring started (${this.healthCheckInterval}ms interval)`);
  }

  /**
   * Stop health check monitoring
   */
  _stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      console.log(`🛑 [${new Date().toISOString()}] MongoDB health monitoring stopped`);
    }
  }

  /**
   * Perform health check
   */
  async _performHealthCheck() {
    this.stats.healthChecks++;

    try {
      // Simple ping to check connection
      await mongoose.connection.db.admin().ping();
      
      // Check connection state
      const state = mongoose.connection.readyState;
      if (state !== 1) { // 1 = connected
        throw new Error(`Connection state: ${this._getConnectionStateName(state)}`);
      }

      this.emit('healthCheckPassed');

    } catch (error) {
      this.stats.healthCheckFailures++;
      console.warn(`⚠️  [${new Date().toISOString()}] MongoDB health check failed:`, error.message);
      this.emit('healthCheckFailed', error);
    }
  }

  /**
   * Get connection state name
   */
  _getConnectionStateName(state) {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    return states[state] || 'unknown';
  }

  /**
   * Graceful shutdown
   */
  async _gracefulShutdown(signal) {
    console.log(`🔄 [${new Date().toISOString()}] ${signal} received - starting graceful MongoDB shutdown`);
    
    this._stopHealthCheck();
    
    if (this.isConnected) {
      try {
        await mongoose.connection.close();
        console.log(`✅ [${new Date().toISOString()}] MongoDB connection closed gracefully`);
      } catch (error) {
        console.error(`❌ [${new Date().toISOString()}] Error during MongoDB shutdown:`, error.message);
      }
    }
    
    this.emit('shutdown');
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const uptime = this.isConnected && this.connectionStartTime 
      ? new Date() - this.connectionStartTime + this.stats.totalUptime
      : this.stats.totalUptime;

    return {
      ...this.stats,
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      currentUptime: uptime,
      connectionState: this._getConnectionStateName(mongoose.connection.readyState),
      poolSize: mongoose.connection.db?.serverConfig?.poolSize || 0,
      healthCheckSuccessRate: this.stats.healthChecks > 0 
        ? ((this.stats.healthChecks - this.stats.healthCheckFailures) / this.stats.healthChecks * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  /**
   * Get database name from connection string
   */
  _getDatabaseName() {
    try {
      if (this.connectionString.includes('/')) {
        const dbName = this.connectionString.split('/').pop().split('?')[0];
        return dbName || 'Unknown';
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Get host information from connection string
   */
  _getHostInfo() {
    try {
      if (this.connectionString.startsWith('mongodb://')) {
        const hostPart = this.connectionString.replace('mongodb://', '').split('/')[0];
        return hostPart || 'Unknown';
      } else if (this.connectionString.startsWith('mongodb+srv://')) {
        const hostPart = this.connectionString.replace('mongodb+srv://', '').split('/')[0];
        return hostPart || 'MongoDB Atlas';
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Force disconnect (for testing or maintenance)
   */
  async disconnect() {
    console.log(`🔌 [${new Date().toISOString()}] Manually disconnecting from MongoDB`);
    this._stopHealthCheck();
    await mongoose.connection.close();
  }

  /**
   * Check if connection is healthy
   */
  isHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get connection readiness for health endpoints
   */
  getHealthStatus() {
    const stats = this.getStats();
    
    return {
      status: this.isHealthy() ? 'healthy' : 'unhealthy',
      database: 'mongodb',
      connectionState: stats.connectionState,
      uptime: stats.currentUptime,
      healthCheckSuccessRate: stats.healthCheckSuccessRate,
      lastConnectionTime: stats.lastConnectionTime,
      connectionAttempts: stats.connectionAttempts,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = MongoDBConnectionManager;