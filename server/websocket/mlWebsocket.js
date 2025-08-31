function initializeMLWebSocket(io) {
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("start_training", (config) => {
      console.log("Training started:", config);
      // Implement training logic
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
}

module.exports = { initializeMLWebSocket };
