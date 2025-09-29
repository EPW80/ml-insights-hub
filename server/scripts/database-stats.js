#!/usr/bin/env node

/**
 * Database Statistics Script
 * 
 * Displays detailed MongoDB connection and database statistics
 * Run with: npm run db:stats
 */

require('dotenv').config();
const MongoDBConnectionManager = require('../config/database');
const mongoose = require('mongoose');

async function displayDatabaseStats() {
  console.log('📊 MongoDB Database Statistics\n');

  const connectionManager = new MongoDBConnectionManager({
    uri: process.env.MONGODB_URI
  });

  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await connectionManager.connect();
    console.log('✅ Connected successfully\n');

    // Connection Manager Statistics
    const connectionStats = connectionManager.getStats();
    console.log('🔗 Connection Manager Statistics:');
    console.log(`   Status: ${connectionStats.isConnected ? 'Connected' : 'Disconnected'}`);
    console.log(`   Connection State: ${connectionStats.connectionState}`);
    console.log(`   Total Connection Attempts: ${connectionStats.connectionAttempts}`);
    console.log(`   Reconnection Attempts: ${connectionStats.reconnectionAttempts}`);
    console.log(`   Current Uptime: ${formatDuration(connectionStats.currentUptime)}`);
    console.log(`   Total Uptime: ${formatDuration(connectionStats.totalUptime)}`);
    console.log(`   Health Checks Performed: ${connectionStats.healthChecks}`);
    console.log(`   Health Check Failures: ${connectionStats.healthCheckFailures}`);
    console.log(`   Health Success Rate: ${connectionStats.healthCheckSuccessRate}`);
    console.log(`   Last Connection: ${connectionStats.lastConnectionTime || 'N/A'}`);

    if (mongoose.connection.readyState === 1) {
      const db = mongoose.connection.db;

      // Database Statistics
      console.log('\n📈 Database Statistics:');
      try {
        const dbStats = await db.stats();
        console.log(`   Database Name: ${db.databaseName}`);
        console.log(`   Collections: ${dbStats.collections || 0}`);
        console.log(`   Objects: ${dbStats.objects || 0}`);
        console.log(`   Average Object Size: ${formatBytes(dbStats.avgObjSize || 0)}`);
        console.log(`   Data Size: ${formatBytes(dbStats.dataSize || 0)}`);
        console.log(`   Storage Size: ${formatBytes(dbStats.storageSize || 0)}`);
        console.log(`   Index Size: ${formatBytes(dbStats.indexSize || 0)}`);
        console.log(`   Total Indexes: ${dbStats.indexes || 0}`);
        console.log(`   Storage Engine: ${dbStats.storageEngine || 'Unknown'}`);
      } catch (error) {
        console.log(`   ❌ Could not retrieve database stats: ${error.message}`);
      }

      // Collection Details
      console.log('\n📋 Collection Information:');
      try {
        const collections = await db.listCollections().toArray();
        
        if (collections.length === 0) {
          console.log('   No collections found');
        } else {
          console.log(`   Found ${collections.length} collections:`);
          
          for (const collection of collections) {
            try {
              const collectionStats = await db.collection(collection.name).stats();
              console.log(`   
   📂 ${collection.name}:`);
              console.log(`      Documents: ${collectionStats.count || 0}`);
              console.log(`      Size: ${formatBytes(collectionStats.size || 0)}`);
              console.log(`      Storage Size: ${formatBytes(collectionStats.storageSize || 0)}`);
              console.log(`      Indexes: ${collectionStats.nindexes || 0}`);
              console.log(`      Index Size: ${formatBytes(collectionStats.totalIndexSize || 0)}`);
              
              if (collectionStats.avgObjSize) {
                console.log(`      Avg Object Size: ${formatBytes(collectionStats.avgObjSize)}`);
              }
            } catch (error) {
              console.log(`      ❌ Could not get stats for ${collection.name}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Could not retrieve collections: ${error.message}`);
      }

      // Server Information
      console.log('\n🖥️  Server Information:');
      try {
        const serverStatus = await db.admin().serverStatus();
        console.log(`   MongoDB Version: ${serverStatus.version}`);
        console.log(`   Process ID: ${serverStatus.pid}`);
        console.log(`   Uptime: ${formatDuration(serverStatus.uptime * 1000)}`);
        console.log(`   Local Time: ${serverStatus.localTime}`);
        
        if (serverStatus.connections) {
          console.log(`   Current Connections: ${serverStatus.connections.current}`);
          console.log(`   Available Connections: ${serverStatus.connections.available}`);
          console.log(`   Total Created: ${serverStatus.connections.totalCreated}`);
        }
        
        if (serverStatus.network) {
          console.log(`   Bytes In: ${formatBytes(serverStatus.network.bytesIn)}`);
          console.log(`   Bytes Out: ${formatBytes(serverStatus.network.bytesOut)}`);
          console.log(`   Requests: ${serverStatus.network.numRequests}`);
        }

        if (serverStatus.opcounters) {
          console.log(`   Operations:`);
          console.log(`      Insert: ${serverStatus.opcounters.insert}`);
          console.log(`      Query: ${serverStatus.opcounters.query}`);
          console.log(`      Update: ${serverStatus.opcounters.update}`);
          console.log(`      Delete: ${serverStatus.opcounters.delete}`);
          console.log(`      Command: ${serverStatus.opcounters.command}`);
        }

      } catch (error) {
        console.log(`   ❌ Server status not available: ${error.message}`);
        console.log('   💡 This might be due to insufficient permissions');
      }

      // Performance Test
      console.log('\n⚡ Performance Metrics:');
      try {
        // Test ping time
        const pingStart = process.hrtime.bigint();
        await db.admin().ping();
        const pingEnd = process.hrtime.bigint();
        const pingTime = Number(pingEnd - pingStart) / 1000000;
        console.log(`   Ping Response Time: ${pingTime.toFixed(2)}ms`);

        // Test collection listing time
        const listStart = process.hrtime.bigint();
        await db.listCollections().toArray();
        const listEnd = process.hrtime.bigint();
        const listTime = Number(listEnd - listStart) / 1000000;
        console.log(`   Collection List Time: ${listTime.toFixed(2)}ms`);

        // Test simple query if there are collections
        const collections = await db.listCollections().toArray();
        if (collections.length > 0) {
          const testCollection = collections[0].name;
          const queryStart = process.hrtime.bigint();
          await db.collection(testCollection).findOne();
          const queryEnd = process.hrtime.bigint();
          const queryTime = Number(queryEnd - queryStart) / 1000000;
          console.log(`   Sample Query Time (${testCollection}): ${queryTime.toFixed(2)}ms`);
        }

      } catch (error) {
        console.log(`   ❌ Performance test failed: ${error.message}`);
      }

      // Index Analysis
      console.log('\n🔍 Index Analysis:');
      try {
        const collections = await db.listCollections().toArray();
        let totalIndexes = 0;
        let totalIndexSize = 0;

        for (const collection of collections) {
          try {
            const indexes = await db.collection(collection.name).indexes();
            const stats = await db.collection(collection.name).stats();
            
            totalIndexes += indexes.length;
            totalIndexSize += stats.totalIndexSize || 0;

            if (indexes.length > 1) { // More than just _id index
              console.log(`   ${collection.name}: ${indexes.length} indexes`);
              indexes.forEach(index => {
                if (index.name !== '_id_') {
                  console.log(`      - ${index.name}: ${JSON.stringify(index.key)}`);
                }
              });
            }
          } catch (error) {
            console.log(`   ❌ Could not analyze indexes for ${collection.name}`);
          }
        }

        console.log(`   Total Indexes: ${totalIndexes}`);
        console.log(`   Total Index Size: ${formatBytes(totalIndexSize)}`);

      } catch (error) {
        console.log(`   ❌ Index analysis failed: ${error.message}`);
      }
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    const stats = connectionManager.getStats();
    
    if (stats.healthCheckFailures > 0) {
      console.log('   ⚠️  Health check failures detected - monitor connection stability');
    }
    
    if (stats.reconnectionAttempts > 0) {
      console.log('   ⚠️  Reconnection attempts occurred - check network stability');
    }
    
    if (parseFloat(stats.healthCheckSuccessRate.replace('%', '')) < 95) {
      console.log('   ⚠️  Health success rate below 95% - investigate connection issues');
    }
    
    if (stats.healthCheckFailures === 0 && stats.reconnectionAttempts === 0) {
      console.log('   ✅ Connection stability is excellent');
    }

    // Cleanup
    await connectionManager.disconnect();
    console.log('\n✅ Statistics collection completed');

  } catch (error) {
    console.error(`\n❌ Failed to collect statistics: ${error.message}`);
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
  if (!ms) return '0s';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled error:', error.message);
  process.exit(1);
});

// Run statistics collection
displayDatabaseStats().catch(error => {
  console.error('\n💥 Statistics script failed:', error.message);
  process.exit(1);
});