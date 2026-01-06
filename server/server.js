const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const compression = require("compression");
const path = require("path");
require("dotenv").config();

// Import structured logger
const logger = require("./config/logger");
const { requestLogger, errorLogger } = require("./middleware/requestLogger");

// Security validation on startup
const StartupSecurityValidator = require("./utils/startupSecurity");
const securityValidator = new StartupSecurityValidator();

// Critical security check - fail fast if insecure
if (!securityValidator.logResults()) {
  logger.error('🛑 Server startup aborted due to critical security issues');
  throw new Error('Server startup aborted due to critical security issues');
}

// Configure Python environment for ML scripts
process.env.PYTHON_PATH = path.join(__dirname, "../venv/bin/python");

// Import security middleware
const {
  generalLimiter,
  mlLimiter,
  authLimiter,
  uploadLimiter,
  securityHeaders,
  mongoSanitizer,
  requestSizeLimiter,
  handleRateLimit,
} = require("./middleware/security");

// Import enhanced MongoDB connection manager
const MongoDBConnectionManager = require("./config/database");

const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize MongoDB connection manager
const dbConnectionManager = new MongoDBConnectionManager({
  uri: process.env.MONGODB_URI,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  maxReconnectAttempts: 5,
  reconnectInterval: 5000,
  healthCheckInterval: 30000
});

// Make connection manager available to routes
app.set('dbConnectionManager', dbConnectionManager);

// Setup connection event handlers
dbConnectionManager.on('connected', () => {
  logger.info('🎉 Database connection established successfully');
});

dbConnectionManager.on('error', (error) => {
  logger.error(`💥 Database connection error: ${error.message}`);
});

dbConnectionManager.on('disconnected', () => {
  logger.warn('⚠️  Database connection lost');
});

dbConnectionManager.on('reconnected', () => {
  logger.info('🔄 Database connection restored');
});

dbConnectionManager.on('maxReconnectAttemptsReached', () => {
  logger.error('🛑 Maximum database reconnection attempts reached');
  logger.error('💡 Please check your MongoDB configuration and network connectivity');
});

dbConnectionManager.on('healthCheckFailed', (error) => {
  logger.warn(`💔 Database health check failed: ${error.message}`);
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

// Request logging middleware
app.use(requestLogger);
app.use(morgan("combined", { stream: logger.stream })); // Use 'combined' format with Winston stream

// Body parsing with strict limits
app.use(
  express.json({
    limit: "10mb", // Reduced from 50mb for security
    verify: (req, res, buf) => {
      // Verify content is valid JSON
      try {
        JSON.parse(buf);
      } catch (e) {
        throw new Error("Invalid JSON");
      }
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb", // Reduced from 50mb for security
  })
);

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes with specific rate limiting
app.use("/api/ml/predict", mlLimiter, require("./routes/ml/predict"));
app.use("/api/ml/train", mlLimiter, require("./routes/ml/train"));
app.use("/api/ml/analyze", mlLimiter, require("./routes/ml/analyze"));
app.use("/api/ml/versions", mlLimiter, require("./routes/ml/versioning"));
app.use("/api/ml/ab-test", mlLimiter, require("./routes/ml/ab-testing"));
app.use("/api/ml/auto-retrain", mlLimiter, require("./routes/ml/auto-retrain"));
app.use("/api/ml/explainability", mlLimiter, require("./routes/ml/explainability"));
app.use("/api/data", uploadLimiter, require("./routes/data"));
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/health", require("./routes/health/database")); // Database health monitoring

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Error logging middleware (must be before error handler)
app.use(errorLogger);

// Initialize database connection on startup
async function initializeDatabase() {
  try {
    logger.info('🔌 Initializing database connection...');
    await dbConnectionManager.connect();
    logger.info('✅ Database initialization completed');
    return true;
  } catch (error) {
    logger.error(`❌ Database initialization failed: ${error.message}`);

    // Critical database errors should stop the application
    if (error.message.includes('authentication') ||
        error.message.includes('not authorized') ||
        error.message.includes('access denied')) {
      logger.error('🛑 Critical database error - stopping application');
      throw new Error(`Critical database error: ${error.message}`);
    }

    // For other errors, log but continue (reconnection will be attempted)
    logger.warn('⚠️  Starting server without database connection (will attempt reconnection)');
    return false;
  }
}

// Error handling middleware (must be after routes)
app.use(handleRateLimit);

// Enhanced global error handler with comprehensive error categorization
app.use((error, req, res, _next) => {
  const timestamp = new Date().toISOString();
  const requestId = req.headers["x-request-id"] || `req_${Date.now()}`;

  // Enhanced error logging with context
  logger.error({
    timestamp,
    requestId,
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    userId: req.user?.id || "anonymous",
  });

  // Error categorization and appropriate responses
  let statusCode = 500;
  let errorType = "internal_server_error";
  let message = error.message;

  // Handle specific error types
  if (error.name === "ValidationError") {
    statusCode = 400;
    errorType = "validation_error";
    message = "Request validation failed";
  } else if (error.name === "CastError") {
    statusCode = 400;
    errorType = "cast_error";
    message = "Invalid data format";
  } else if (error.name === "MongoError" || error.name === "MongoServerError") {
    statusCode = 503;
    errorType = "database_error";
    message = "Database operation failed";
  } else if (error.message === "Invalid JSON") {
    statusCode = 400;
    errorType = "json_parse_error";
    message = "Request body contains invalid JSON";
  } else if (error.name === "MulterError") {
    statusCode = 400;
    errorType = "file_upload_error";
    message = "File upload failed";
  } else if (error.code === "ENOENT") {
    statusCode = 404;
    errorType = "file_not_found";
    message = "Requested resource not found";
  } else if (error.code === "EACCES") {
    statusCode = 403;
    errorType = "permission_denied";
    message = "Access denied";
  } else if (error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED") {
    statusCode = 503;
    errorType = "service_unavailable";
    message = "External service unavailable";
  }

  // Create error response
  const errorResponse = {
    success: false,
    error: {
      type: errorType,
      message:
        process.env.NODE_ENV === "production" && statusCode === 500
          ? "Internal server error"
          : message,
      timestamp: timestamp,
      requestId: requestId,
    },
  };

  // Add additional error details in development
  if (process.env.NODE_ENV !== "production") {
    errorResponse.error.details = {
      name: error.name,
      stack: error.stack,
      url: req.url,
      method: req.method,
    };
  }

  // Add validation errors if present
  if (error.errors) {
    errorResponse.error.validation_errors = Object.keys(error.errors).map(
      (field) => ({
        field: field,
        message: error.errors[field].message,
      })
    );
  }

  res.status(statusCode).json(errorResponse);
});

// Handle 404 errors for undefined routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      type: "route_not_found",
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
    },
  });
});

// Process-level error handlers
process.on("uncaughtException", (error) => {
  console.error("========== UNCAUGHT EXCEPTION ==========");
  console.error("Message:", error.message);
  console.error("Stack:", error.stack);
  console.error("========================================");
  logger.error({ message: 'Uncaught Exception', error: error.message, stack: error.stack });
  // Throw error to let Node.js handle the exit
  throw error;
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error({ message: 'Unhandled Rejection', reason, promise });
  // Don't exit process for unhandled promise rejections in production
  if (process.env.NODE_ENV !== "production") {
    throw new Error(`Unhandled Promise Rejection: ${reason}`);
  }
});

// Graceful shutdown handler
process.on("SIGTERM", () => {
  logger.info('SIGTERM received, starting graceful shutdown');

  server.close(() => {
    logger.info("HTTP server closed");

    // Close database connection
    mongoose.connection.close(false, () => {
      logger.info("MongoDB connection closed");
      // eslint-disable-next-line no-process-exit
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  logger.info('SIGINT received, starting graceful shutdown');

  server.close(() => {
    logger.info("HTTP server closed");

    mongoose.connection.close(false, () => {
      logger.info("MongoDB connection closed");
      // eslint-disable-next-line no-process-exit
      process.exit(0);
    });
  });
});

// WebSocket handling
require("./websocket/mlWebsocket").initializeMLWebSocket(io);

// Start server with database initialization
async function startServer() {
  try {
    // Initialize database connection
    const dbInitialized = await initializeDatabase();
    
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);

      // Log security and environment status
      if (process.env.NODE_ENV === "production") {
        logger.info("🔒 Production security mode enabled");
        logger.info("✅ Rate limiting: ACTIVE");
        logger.info("✅ CORS protection: ACTIVE");
        logger.info("✅ Security headers: ACTIVE");
        logger.info("✅ Input validation: ACTIVE");
      } else {
        logger.warn("⚠️  Development mode - security relaxed");
        logger.warn("⚠️  Ensure JWT_SECRET is secure for production");
        logger.warn("⚠️  Enable HTTPS in production");
      }

      // Log configuration status
      logger.info(
        `MongoDB: ${dbInitialized ? "CONNECTED" : "CONNECTING..."}`
      );
      logger.info(`Python: ${process.env.PYTHON_PATH || "python3"}`);
      logger.info(
        `Upload dir: ${path.resolve(__dirname, "uploads")}`
      );

      // Log database statistics if connected
      if (dbInitialized) {
        const stats = dbConnectionManager.getStats();
        logger.info(`Database stats: ${stats.connectionAttempts} attempts, ${stats.healthCheckSuccessRate} health rate`);
      }

      logger.info(`🚀 ML Insights Hub Server ready!`);
    });

  } catch (error) {
    logger.error(`💥 Server startup failed: ${error.message}`);
    throw new Error(`Server startup failed: ${error.message}`);
  }
}

// Start the server
startServer();

module.exports = app;
