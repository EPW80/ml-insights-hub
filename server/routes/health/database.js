/**
 * Database Health Monitoring Routes
 * 
 * Provides endpoints for monitoring database connection health,
 * performance metrics, and operational status
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * Database health check endpoint
 * GET /api/health/database
 */
router.get('/database', async (req, res) => {
  try {
    const connectionManager = req.app.get('dbConnectionManager');
    
    if (!connectionManager) {
      return res.status(500).json({
        status: 'error',
        message: 'Database connection manager not available'
      });
    }

    const healthStatus = connectionManager.getHealthStatus();
    const stats = connectionManager.getStats();

    // Additional database metrics
    const dbMetrics = await getDatabaseMetrics();

    const response = {
      ...healthStatus,
      metrics: {
        ...stats,
        ...dbMetrics
      }
    };

    // Return appropriate HTTP status based on health
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(response);

  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Database connection statistics
 * GET /api/health/database/stats
 */
router.get('/database/stats', async (req, res) => {
  try {
    const connectionManager = req.app.get('dbConnectionManager');
    
    if (!connectionManager) {
      return res.status(500).json({
        error: 'Database connection manager not available'
      });
    }

    const stats = connectionManager.getStats();
    const dbMetrics = await getDatabaseMetrics();

    res.json({
      connection: stats,
      database: dbMetrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stats retrieval failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve database statistics',
      message: error.message
    });
  }
});

/**
 * Connection performance test
 * GET /api/health/database/performance
 */
router.get('/database/performance', async (req, res) => {
  try {
    const startTime = process.hrtime.bigint();
    
    // Perform a simple database operation
    await mongoose.connection.db.admin().ping();
    
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

    // Test collection operations if connected
    let collectionTest = null;
    if (mongoose.connection.readyState === 1) {
      const testStart = process.hrtime.bigint();
      const collections = await mongoose.connection.db.listCollections().toArray();
      const testEnd = process.hrtime.bigint();
      
      collectionTest = {
        collectionsCount: collections.length,
        queryTime: Number(testEnd - testStart) / 1000000
      };
    }

    res.json({
      status: 'success',
      performance: {
        pingResponseTime: `${responseTime.toFixed(2)}ms`,
        connectionState: getConnectionStateName(mongoose.connection.readyState),
        collections: collectionTest
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Performance test failed:', error);
    res.status(500).json({
      status: 'error',
      error: 'Performance test failed',
      message: error.message
    });
  }
});

/**
 * Force connection reconnection (admin only)
 * POST /api/health/database/reconnect
 */
router.post('/database/reconnect', async (req, res) => {
  try {
    // Add authentication/authorization here if needed
    const connectionManager = req.app.get('dbConnectionManager');
    
    if (!connectionManager) {
      return res.status(500).json({
        error: 'Database connection manager not available'
      });
    }

    console.log('🔄 Manual reconnection requested');
    
    // Disconnect and reconnect
    await connectionManager.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await connectionManager.connect();

    res.json({
      status: 'success',
      message: 'Database reconnection initiated',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Reconnection failed:', error);
    res.status(500).json({
      status: 'error',
      error: 'Reconnection failed',
      message: error.message
    });
  }
});

/**
 * Get detailed database metrics
 */
async function getDatabaseMetrics() {
  try {
    if (mongoose.connection.readyState !== 1) {
      return {
        status: 'disconnected',
        readyState: mongoose.connection.readyState
      };
    }

    const db = mongoose.connection.db;
    
    // Get database stats
    const dbStats = await db.stats();
    
    // Get server status (if available)
    let serverStatus = null;
    try {
      serverStatus = await db.admin().serverStatus();
    } catch (error) {
      // Server status might not be available depending on permissions
      console.warn('Could not retrieve server status:', error.message);
    }

    // Get collection information
    const collections = await db.listCollections().toArray();

    return {
      database: {
        name: db.databaseName,
        collections: collections.length,
        dataSize: formatBytes(dbStats.dataSize || 0),
        storageSize: formatBytes(dbStats.storageSize || 0),
        indexSize: formatBytes(dbStats.indexSize || 0),
        objects: dbStats.objects || 0,
        indexes: dbStats.indexes || 0
      },
      server: serverStatus ? {
        version: serverStatus.version,
        uptime: serverStatus.uptime,
        connections: serverStatus.connections
      } : null,
      performance: {
        avgObjSize: dbStats.avgObjSize || 0,
        storageEngine: dbStats.storageEngine || 'unknown'
      }
    };

  } catch (error) {
    console.error('Error getting database metrics:', error);
    return {
      error: 'Could not retrieve database metrics',
      message: error.message
    };
  }
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get connection state name
 */
function getConnectionStateName(state) {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[state] || 'unknown';
}

module.exports = router;