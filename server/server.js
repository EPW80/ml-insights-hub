const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const path = require("path");
require("dotenv").config();

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

const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
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

// Enhanced global error handler with comprehensive error categorization
app.use((error, req, res, next) => {
  const timestamp = new Date().toISOString();
  const requestId = req.headers["x-request-id"] || `req_${Date.now()}`;

  // Enhanced error logging with context
  console.error(`[${timestamp}] [${requestId}] Error occurred:`, {
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
  console.error(`[${new Date().toISOString()}] Uncaught Exception:`, error);
  // Graceful shutdown
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    `[${new Date().toISOString()}] Unhandled Rejection at:`,
    promise,
    "reason:",
    reason
  );
  // Don't exit process for unhandled promise rejections in production
  if (process.env.NODE_ENV !== "production") {
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
});

// Graceful shutdown handler
process.on("SIGTERM", () => {
  console.log(
    `[${new Date().toISOString()}] SIGTERM received, starting graceful shutdown`
  );

  server.close(() => {
    console.log("HTTP server closed");

    // Close database connection
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log(
    `[${new Date().toISOString()}] SIGINT received, starting graceful shutdown`
  );

  server.close(() => {
    console.log("HTTP server closed");

    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });
});

// WebSocket handling
require("./websocket/mlWebsocket").initializeMLWebSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);

  // Log security and environment status
  if (process.env.NODE_ENV === "production") {
    console.log("🔒 Production security mode enabled");
    console.log("✅ Rate limiting: ACTIVE");
    console.log("✅ CORS protection: ACTIVE");
    console.log("✅ Security headers: ACTIVE");
    console.log("✅ Input validation: ACTIVE");
  } else {
    console.log("⚠️  Development mode - security relaxed");
    console.log("⚠️  Ensure JWT_SECRET is secure for production");
    console.log("⚠️  Enable HTTPS in production");
  }

  // Log configuration status
  console.log(
    `📊 MongoDB: ${process.env.MONGO_URI ? "CONFIGURED" : "NOT CONFIGURED"}`
  );
  console.log(`🐍 Python: ${process.env.PYTHON_PATH || "python3"}`);
  console.log(
    `🔑 JWT Secret: ${process.env.JWT_SECRET ? "CONFIGURED" : "USING DEFAULT"}`
  );
});

module.exports = app;
