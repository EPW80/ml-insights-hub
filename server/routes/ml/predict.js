const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");
const Prediction = require("../../models/Prediction");
const {
  runPythonScript,
  executeMlPrediction,
  PythonExecutionError,
  PythonTimeoutError,
  PythonSecurityError,
} = require("../../utils/securePythonBridge");

// Import authentication middleware
const { requireAuthOrApiKey, logAuthenticatedRequest } = require("../../middleware/mlAuth");

// Apply authentication to all routes in this router
router.use(requireAuthOrApiKey);
router.use(logAuthenticatedRequest);

// Legacy alias for backward compatibility
const PythonParseError = PythonExecutionError;

// Enhanced error response helper
function sendErrorResponse(res, error, statusCode = 500) {
  const errorResponse = {
    success: false,
    error: error.message || "An unexpected error occurred",
    timestamp: new Date().toISOString(),
  };

  // Add specific error details based on error type
  if (error instanceof PythonExecutionError) {
    errorResponse.type = "python_execution_error";
    errorResponse.details = {
      exitCode: error.details?.exitCode,
      executionTime: error.details?.executionTime,
    };
    statusCode = 422; // Unprocessable Entity
  } else if (error instanceof PythonTimeoutError) {
    errorResponse.type = "timeout_error";
    errorResponse.details = {
      timeout: error.details?.timeout,
      retryCount: error.details?.retryCount,
    };
    statusCode = 408; // Request Timeout
  } else if (error instanceof PythonSecurityError) {
    errorResponse.type = "security_error";
    errorResponse.details = {
      securityViolation: error.type,
      timestamp: error.timestamp,
    };
    statusCode = 403; // Forbidden
    // Log security incident
    console.error("🚨 SECURITY VIOLATION in ML Prediction:", {
      error: error.message,
      type: error.type,
      timestamp: error.timestamp,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  } else if (error instanceof PythonParseError) {
    errorResponse.type = "validation_error";
    statusCode = 400; // Bad Request
  } else if (error.name === "ValidationError") {
    errorResponse.type = "database_validation_error";
    errorResponse.details = Object.keys(error.errors || {});
    statusCode = 400;
  } else if (error.name === "MongoError" || error.name === "MongoServerError") {
    errorResponse.type = "database_error";
    statusCode = 503; // Service Unavailable
  }

  console.error(`[${new Date().toISOString()}] Prediction API Error:`, {
    type: errorResponse.type,
    message: error.message,
    stack: error.stack,
    details: error.details,
  });

  res.status(statusCode).json(errorResponse);
}

router.post("/", async (req, res) => {
  const startTime = Date.now();

  try {
    // Enhanced input validation
    const { features, modelType, uncertaintyMethod } = req.body;

    if (!features || !modelType) {
      return sendErrorResponse(
        res,
        new Error("Missing required parameters: features and modelType"),
        400
      );
    }

    // Validate features structure
    if (typeof features !== "object" || Array.isArray(features)) {
      return sendErrorResponse(
        res,
        new Error("Features must be an object"),
        400
      );
    }

    // Validate model type
    const validModelTypes = [
      "linear_regression",
      "random_forest",
      "neural_network",
      "gradient_boosting",
    ];
    if (!validModelTypes.includes(modelType)) {
      return sendErrorResponse(
        res,
        new Error(
          `Invalid model type. Must be one of: ${validModelTypes.join(", ")}`
        ),
        400
      );
    }

    // Validate uncertainty method if provided
    const validUncertaintyMethods = [
      "ensemble",
      "bootstrap",
      "quantile",
      "bayesian",
    ];
    if (
      uncertaintyMethod &&
      !validUncertaintyMethods.includes(uncertaintyMethod)
    ) {
      return sendErrorResponse(
        res,
        new Error(
          `Invalid uncertainty method. Must be one of: ${validUncertaintyMethods.join(
            ", "
          )}`
        ),
        400
      );
    }

    // Enhanced Python script execution with secure bridge
    const result = await executeMlPrediction(
      features, 
      modelType, 
      uncertaintyMethod || "ensemble"
    );

    // Validate Python script output
    if (!result || typeof result !== "object") {
      throw new PythonParseError("Invalid response from prediction script");
    }

    const requiredFields = [
      "prediction",
      "lower_bound",
      "upper_bound",
      "confidence_level",
    ];
    const missingFields = requiredFields.filter(
      (field) => result[field] === undefined
    );
    if (missingFields.length > 0) {
      throw new PythonParseError(
        `Missing required fields in prediction result: ${missingFields.join(
          ", "
        )}`
      );
    }

    // Create prediction document with enhanced error handling
    let prediction;
    try {
      prediction = new Prediction({
        property_features: features,
        model_type: modelType,
        prediction: {
          point_estimate: result.prediction,
          lower_bound: result.lower_bound,
          upper_bound: result.upper_bound,
          confidence_level: result.confidence_level,
          uncertainty_metrics: result.uncertainty_metrics || {},
        },
        feature_importance: result.feature_importance || {},
        execution_time: Date.now() - startTime,
        timestamp: new Date(),
      });

      await prediction.save();
    } catch (dbError) {
      console.error("Database save error:", dbError);
      throw dbError;
    }

    // Success response
    res.json({
      success: true,
      prediction: prediction,
      execution_time: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

module.exports = router;
