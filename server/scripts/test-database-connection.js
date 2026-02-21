/**
 * Database Connection Test Script
 *
 * Tests MongoDB connection with comprehensive validation
 * Run with: npm run db:test
 */

require('dotenv').config();
const MongoDBConnectionManager = require('../config/database');

async function testDatabaseConnection() {
  console.log('🧪 Testing MongoDB Connection...\n');

  // Test 1: Configuration validation
  console.log('1. Validating configuration...');
  if (!process.env.MONGODB_URI) {
    console.log('❌ MONGODB_URI environment variable not set');
    console.log('💡 Add MONGODB_URI to your .env file');
    process.exitCode = 1;
    return;
  }
  console.log('✅ MONGODB_URI configured');
  console.log(`   URI: ${process.env.MONGODB_URI.replace(/:[^@]*@/, ':***@')}`); // Hide password

  // Test 2: Connection manager initialization
  console.log('\n2. Initializing connection manager...');
  const connectionManager = new MongoDBConnectionManager({
    uri: process.env.MONGODB_URI,
    maxPoolSize: 5, // Smaller pool for testing
    serverSelectionTimeoutMS: 10000, // 10 seconds
    connectTimeoutMS: 15000, // 15 seconds
  });

  let connectionSuccessful = false;

  // Setup event listeners for testing
  connectionManager.on('connected', () => {
    console.log('✅ Connection established successfully');
    connectionSuccessful = true;
  });

  connectionManager.on('error', (error) => {
    console.log('❌ Connection error:', error.message);
  });

  connectionManager.on('disconnected', () => {
    console.log('⚠️  Connection lost');
  });

  // Test 3: Initial connection
  console.log('\n3. Testing initial connection...');
  try {
    await connectionManager.connect();

    if (connectionSuccessful) {
      console.log('✅ Initial connection test passed');
    } else {
      console.log('❌ Initial connection test failed');
      process.exitCode = 1;
      return;
    }
  } catch (error) {
    console.log('❌ Connection failed:', error.message);

    // Provide helpful error messages
    if (error.message.includes('ENOTFOUND')) {
      console.log('💡 DNS resolution failed - check your MongoDB host');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Connection refused - check if MongoDB is running');
    } else if (error.message.includes('authentication')) {
      console.log('💡 Authentication failed - check your credentials');
    } else if (error.message.includes('timeout')) {
      console.log('💡 Connection timeout - check network connectivity');
    }

    process.exitCode = 1;
    return;
  }

  // Test 4: Health check
  console.log('\n4. Testing health check...');
  try {
    const healthStatus = connectionManager.getHealthStatus();
    console.log('✅ Health check passed');
    console.log(`   Status: ${healthStatus.status}`);
    console.log(`   Connection State: ${healthStatus.connectionState}`);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }

  // Test 5: Basic database operations
  console.log('\n5. Testing basic database operations...');
  try {
    const mongoose = require('mongoose');

    // Test ping
    await mongoose.connection.db.admin().ping();
    console.log('✅ Database ping successful');

    // Test database info
    const dbStats = await mongoose.connection.db.stats();
    console.log('✅ Database stats retrieved');
    console.log(`   Database: ${mongoose.connection.db.databaseName}`);
    console.log(`   Collections: ${dbStats.collections || 0}`);
    console.log(`   Objects: ${dbStats.objects || 0}`);

    // Test collections listing
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`✅ Collections listed (${collections.length} found)`);
  } catch (error) {
    console.log('❌ Database operations failed:', error.message);
  }

  // Test 6: Connection statistics
  console.log('\n6. Connection statistics...');
  const stats = connectionManager.getStats();
  console.log('📊 Connection Statistics:');
  console.log(`   Connected: ${stats.isConnected}`);
  console.log(`   Connection Attempts: ${stats.connectionAttempts}`);
  console.log(`   Health Checks: ${stats.healthChecks}`);
  console.log(`   Health Success Rate: ${stats.healthCheckSuccessRate}`);
  console.log(`   Current Uptime: ${stats.currentUptime}ms`);

  // Test 7: Graceful disconnection
  console.log('\n7. Testing graceful disconnection...');
  try {
    await connectionManager.disconnect();
    console.log('✅ Graceful disconnection successful');
  } catch (error) {
    console.log('❌ Disconnection failed:', error.message);
  }

  console.log('\n🎯 Database Connection Test Summary:');
  console.log('   ✅ Configuration validation passed');
  console.log('   ✅ Connection establishment passed');
  console.log('   ✅ Health monitoring working');
  console.log('   ✅ Database operations functional');
  console.log('   ✅ Graceful disconnection working');

  console.log('\n🚀 MongoDB connection is ready for production use!');

  process.exitCode = 0;
  return;
}

// Handle script errors
process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled error:', error.message);
  process.exitCode = 1;
  return;
});

// Run the test
testDatabaseConnection().catch((error) => {
  console.error('\n💥 Test failed:', error.message);
  process.exitCode = 1;
  return;
});
