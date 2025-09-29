#!/usr/bin/env node

/**
 * Database Health Check Script
 * 
 * Performs comprehensive health check of MongoDB connection
 * Run with: npm run db:health
 */

require('dotenv').config();
const MongoDBConnectionManager = require('../config/database');
const mongoose = require('mongoose');

async function performHealthCheck() {
  console.log('💓 MongoDB Health Check\n');

  const connectionManager = new MongoDBConnectionManager({
    uri: process.env.MONGODB_URI,
    healthCheckInterval: 5000 // 5 seconds for testing
  });

  let healthChecksPassed = 0;
  let healthChecksFailed = 0;

  // Monitor health check events
  connectionManager.on('healthCheckPassed', () => {
    healthChecksPassed++;
    console.log(`✅ Health check ${healthChecksPassed} passed`);
  });

  connectionManager.on('healthCheckFailed', (error) => {
    healthChecksFailed++;
    console.log(`❌ Health check ${healthChecksFailed} failed: ${error.message}`);
  });

  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await connectionManager.connect();

    // Wait for a few health checks
    console.log('⏳ Monitoring health checks for 15 seconds...\n');
    
    const startTime = Date.now();
    const monitorDuration = 15000; // 15 seconds

    // Wait and monitor
    await new Promise(resolve => setTimeout(resolve, monitorDuration));

    // Get final statistics
    const stats = connectionManager.getStats();
    const healthStatus = connectionManager.getHealthStatus();

    console.log('\n📊 Health Check Results:');
    console.log(`   Overall Status: ${healthStatus.status}`);
    console.log(`   Connection State: ${healthStatus.connectionState}`);
    console.log(`   Uptime: ${stats.currentUptime}ms`);
    console.log(`   Health Checks Performed: ${stats.healthChecks}`);
    console.log(`   Health Check Failures: ${stats.healthCheckFailures}`);
    console.log(`   Success Rate: ${stats.healthCheckSuccessRate}`);

    // Detailed database information
    console.log('\n🔍 Database Details:');
    if (mongoose.connection.readyState === 1) {
      const db = mongoose.connection.db;
      const dbStats = await db.stats();
      
      console.log(`   Database Name: ${db.databaseName}`);
      console.log(`   Collections: ${dbStats.collections || 0}`);
      console.log(`   Objects: ${dbStats.objects || 0}`);
      console.log(`   Data Size: ${formatBytes(dbStats.dataSize || 0)}`);
      console.log(`   Storage Size: ${formatBytes(dbStats.storageSize || 0)}`);
      console.log(`   Index Size: ${formatBytes(dbStats.indexSize || 0)}`);

      // Test response times
      console.log('\n⚡ Performance Test:');
      const pingStart = process.hrtime.bigint();
      await db.admin().ping();
      const pingEnd = process.hrtime.bigint();
      const pingTime = Number(pingEnd - pingStart) / 1000000;
      console.log(`   Ping Response Time: ${pingTime.toFixed(2)}ms`);

      // Test collection operations
      const listStart = process.hrtime.bigint();
      const collections = await db.listCollections().toArray();
      const listEnd = process.hrtime.bigint();
      const listTime = Number(listEnd - listStart) / 1000000;
      console.log(`   Collections List Time: ${listTime.toFixed(2)}ms`);
      console.log(`   Collections Found: ${collections.length}`);

      // Check server status (if available)
      try {
        const serverStatus = await db.admin().serverStatus();
        console.log('\n🖥️  Server Information:');
        console.log(`   MongoDB Version: ${serverStatus.version}`);
        console.log(`   Server Uptime: ${formatDuration(serverStatus.uptime * 1000)}`);
        console.log(`   Active Connections: ${serverStatus.connections?.current || 'N/A'}`);
        console.log(`   Available Connections: ${serverStatus.connections?.available || 'N/A'}`);
      } catch (error) {
        console.log('⚠️  Server status not available (insufficient permissions)');
      }
    }

    // Recommendations
    console.log('\n💡 Health Assessment:');
    if (stats.healthCheckSuccessRate === '100.00%') {
      console.log('   🎉 Excellent! Database connection is very stable');
    } else if (parseFloat(stats.healthCheckSuccessRate) >= 90) {
      console.log('   ✅ Good! Database connection is stable');
    } else if (parseFloat(stats.healthCheckSuccessRate) >= 75) {
      console.log('   ⚠️  Warning! Database connection has some issues');
      console.log('   💡 Consider checking network connectivity and server load');
    } else {
      console.log('   ❌ Critical! Database connection is unstable');
      console.log('   💡 Immediate attention required - check MongoDB server and network');
    }

    // Disconnect
    await connectionManager.disconnect();
    console.log('\n✅ Health check completed successfully');

  } catch (error) {
    console.error('\n❌ Health check failed:', error.message);
    
    // Provide specific guidance based on error
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 MongoDB server appears to be down or unreachable');
      console.log('   - Check if MongoDB is running');
      console.log('   - Verify the connection string');
      console.log('   - Check firewall settings');
    } else if (error.message.includes('authentication')) {
      console.log('💡 Authentication failed');
      console.log('   - Verify username and password');
      console.log('   - Check database permissions');
    } else if (error.message.includes('timeout')) {
      console.log('💡 Connection timeout');
      console.log('   - Check network connectivity');
      console.log('   - Verify MongoDB server is responsive');
    }
    
    process.exit(1);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled error during health check:', error.message);
  process.exit(1);
});

// Run health check
performHealthCheck().catch(error => {
  console.error('\n💥 Health check script failed:', error.message);
  process.exit(1);
});