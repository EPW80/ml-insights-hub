const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  // Start MongoDB Memory Server
  const mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '7.0.0'
    }
  });

  const mongoUri = mongoServer.getUri();

  // Store the server instance and URI globally
  global.__MONGOINSTANCE__ = mongoServer;
  process.env.MONGODB_URI_TEST = mongoUri;

  console.log('\n🚀 MongoDB Memory Server started');
  console.log(`📍 URI: ${mongoUri}\n`);
};
