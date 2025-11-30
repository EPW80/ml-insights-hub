module.exports = async () => {
  // Stop MongoDB Memory Server
  const mongoServer = global.__MONGOINSTANCE__;

  if (mongoServer) {
    await mongoServer.stop();
    console.log('\n🛑 MongoDB Memory Server stopped\n');
  }
};
