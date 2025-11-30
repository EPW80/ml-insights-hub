const mongoose = require('mongoose');

// Setup that runs before each test file
beforeAll(async () => {
  // Connect to the in-memory MongoDB instance
  const mongoUri = process.env.MONGODB_URI_TEST;

  if (mongoUri) {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }
});

// Cleanup between tests
afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;

    // Clear all collections
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

// Cleanup after all tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

// Increase timeout for database operations
jest.setTimeout(10000);
