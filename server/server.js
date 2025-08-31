const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const path = require("path");
require("dotenv").config();

// Import security middleware
const {
  generalLimiter,
  mlLimiter,
  authLimiter,
  uploadLimiter,
  securityHeaders,
  mongoSanitizer,
  requestSizeLimiter,
  handleRateLimit
} = require('./middleware/security');

const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
});

// Security Middleware (order matters!)
app.use(securityHeaders); // Enhanced security headers
app.use(mongoSanitizer); // Prevent NoSQL injection
app.use(requestSizeLimiter); // Limit request size
app.use(generalLimiter); // General rate limiting

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(compression());
app.use(morgan("combined")); // Use 'combined' format for better security logging

// Body parsing with strict limits
app.use(express.json({ 
  limit: "10mb", // Reduced from 50mb for security
  verify: (req, res, buf) => {
    // Verify content is valid JSON
    try {
      JSON.parse(buf);
    } catch (e) {
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: "10mb" // Reduced from 50mb for security
}));

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes with specific rate limiting
app.use("/api/ml/predict", mlLimiter, require("./routes/ml/predict"));
app.use("/api/ml/train", mlLimiter, require("./routes/ml/train"));
app.use("/api/ml/analyze", mlLimiter, require("./routes/ml/analyze"));
app.use("/api/data", uploadLimiter, require("./routes/data"));
app.use("/api/auth", authLimiter, require("./routes/auth"));

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Database connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Error handling middleware (must be after routes)
app.use(handleRateLimit);

// Global error handler
app.use((error, req, res, next) => {
  console.error('Error occurred:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message
    });
  }
  
  if (error.message === 'Invalid JSON') {
    return res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON'
    });
  }
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;
    
  res.status(500).json({
    error: 'Internal Server Error',
    message
  });
});

// WebSocket handling
require("./websocket/mlWebsocket").initializeMLWebSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Log security status
  if (process.env.NODE_ENV === 'production') {
    console.log('🔒 Production security mode enabled');
  } else {
    console.log('⚠️  Development mode - ensure JWT_SECRET is secure for production');
  }
});

module.exports = app;
