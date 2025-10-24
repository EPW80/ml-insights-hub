const express = require("express");
const router = express.Router();
// Import authentication middleware
const { requireAuthOrApiKey, logAuthenticatedRequest } = require("../../middleware/mlAuth");

// Apply authentication to all routes in this router
router.use(requireAuthOrApiKey);
router.use(logAuthenticatedRequest);

const Model = require("../../models/Model");
const {
  runPythonScript,
  executeModelTraining,
  PythonExecutionError,
  PythonTimeoutError,
  PythonSecurityError,
} = require("../../utils/securePythonBridge");

// Legacy alias for backward compatibility
const PythonParseError = PythonExecutionError;
const path = require("path");

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
    statusCode = 422;
  } else if (error instanceof PythonTimeoutError) {
    errorResponse.type = "timeout_error";
    errorResponse.details = {
      timeout: error.details?.timeout,
      retryCount: error.details?.retryCount,
    };
    statusCode = 408;
  } else if (error instanceof PythonSecurityError) {
    errorResponse.type = "security_error";
    errorResponse.details = {
      securityViolation: error.type,
      timestamp: error.timestamp,
    };
    statusCode = 403;
    // Log security incident
    console.error("🚨 SECURITY VIOLATION in Model Training:", {
      error: error.message,
      type: error.type,
      timestamp: error.timestamp
    });
  } else if (error instanceof PythonParseError) {
    errorResponse.type = "validation_error";
    statusCode = 400;
  }

  console.error(`[${new Date().toISOString()}] Training API Error:`, {
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
    const {
      modelType,
      datasetId,
      hyperparameters,
      useStreaming = false,
    } = req.body;

    // Enhanced input validation
    if (!modelType || !datasetId) {
      return sendErrorResponse(
        res,
        new Error("Missing required parameters: modelType and datasetId"),
        400
      );
    }

    // Validate model type
    const validModelTypes = [
      "linear_regression",
      "random_forest",
      "neural_network",
      "gradient_boosting",
      "svm",
      "xgboost",
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

    // Validate hyperparameters if provided
    if (hyperparameters && typeof hyperparameters !== "object") {
      return sendErrorResponse(
        res,
        new Error("Hyperparameters must be an object"),
        400
      );
    }

    const inputData = {
      model_type: modelType,
      dataset_id: datasetId,
      hyperparameters: hyperparameters || {},
      training_config: {
        test_size: 0.2,
        random_state: 42,
        cross_validation: true,
        validation_folds: 5,
      },
    };

    const scriptPath = path.join(
      __dirname,
      "../../python-scripts/train_model.py"
    );

    // Handle streaming vs non-streaming training
    if (useStreaming && res.socket) {
      // Set up server-sent events for real-time training updates
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      let trainingResult = null;

      try {
        await streamPythonScript(
          scriptPath,
          inputData,
          (data) => {
            // Send training progress to client
            res.write(`data: ${JSON.stringify(data)}\n\n`);
          },
          {
            timeout: 300000, // 5 minutes for training
            maxRetries: 1,
            onProgress: (progress) => {
              res.write(
                `data: ${JSON.stringify({ type: "progress", ...progress })}\n\n`
              );
            },
          }
        );

        res.write(
          `data: ${JSON.stringify({ type: "complete", success: true })}\n\n`
        );
        res.end();
      } catch (error) {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            error: error.message,
            details: error.details || {},
          })}\n\n`
        );
        res.end();
      }
    } else {
      // Standard training with single response
      const result = await runPythonScript(scriptPath, inputData, {
        timeout: 300000, // 5 minutes for training
        maxRetries: 1,
        onProgress: (progress) => {
          console.log("Training progress:", progress);
        },
      });

      // Validate training result
      if (!result || typeof result !== "object") {
        throw new PythonParseError("Invalid response from training script");
      }

      const requiredFields = ["model_id", "metrics", "training_time"];
      const missingFields = requiredFields.filter(
        (field) => result[field] === undefined
      );
      if (missingFields.length > 0) {
        throw new PythonParseError(
          `Missing required fields in training result: ${missingFields.join(
            ", "
          )}`
        );
      }

      // Save model metadata to database
      let model;
      try {
        model = new Model({
          model_id: result.model_id,
          model_type: modelType,
          dataset_id: datasetId,
          hyperparameters: hyperparameters || {},
          metrics: result.metrics,
          training_time: result.training_time,
          feature_importance: result.feature_importance || {},
          model_path: result.model_path,
          created_at: new Date(),
          status: "trained",
        });

        await model.save();
      } catch (dbError) {
        console.error("Database save error:", dbError);
        throw dbError;
      }

      res.json({
        success: true,
        model: model,
        execution_time: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    if (!res.headersSent) {
      sendErrorResponse(res, error);
    }
  }
});

// Route for checking training status
router.get("/status/:modelId", async (req, res) => {
  try {
    const { modelId } = req.params;

    const model = await Model.findOne({ model_id: modelId });
    if (!model) {
      return res.status(404).json({
        success: false,
        error: "Model not found",
      });
    }

    res.json({
      success: true,
      model: model,
      status: model.status,
    });
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

module.exports = router;
