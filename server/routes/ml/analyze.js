const express = require("express");
const router = express.Router();
const {
  runPythonScript,
  streamPythonScript,
  PythonExecutionError,
  PythonTimeoutError,
  PythonParseError,
} = require("../../utils/pythonBridge");
const path = require("path");

// Enhanced error response helper
function sendErrorResponse(res, error, statusCode = 500) {
  const errorResponse = {
    success: false,
    error: error.message || "An unexpected error occurred",
    timestamp: new Date().toISOString(),
  };

  if (error instanceof PythonExecutionError) {
    errorResponse.type = "python_execution_error";
    errorResponse.details = {
      exitCode: error.details.exitCode,
      executionTime: error.details.executionTime,
    };
    statusCode = 422;
  } else if (error instanceof PythonTimeoutError) {
    errorResponse.type = "timeout_error";
    errorResponse.details = {
      timeout: error.details.timeout,
      retryCount: error.details.retryCount,
    };
    statusCode = 408;
  } else if (error instanceof PythonParseError) {
    errorResponse.type = "validation_error";
    statusCode = 400;
  }

  console.error(`[${new Date().toISOString()}] Analysis API Error:`, {
    type: errorResponse.type,
    message: error.message,
    stack: error.stack,
    details: error.details,
  });

  res.status(statusCode).json(errorResponse);
}

// Clustering analysis endpoint
router.post("/cluster", async (req, res) => {
  const startTime = Date.now();

  try {
    const { datasetId, features, algorithm, parameters } = req.body;

    // Enhanced input validation
    if (!datasetId || !features || !algorithm) {
      return sendErrorResponse(
        res,
        new Error(
          "Missing required parameters: datasetId, features, and algorithm"
        ),
        400
      );
    }

    // Validate algorithm type
    const validAlgorithms = [
      "kmeans",
      "dbscan",
      "hierarchical",
      "gaussian_mixture",
      "mean_shift",
    ];
    if (!validAlgorithms.includes(algorithm)) {
      return sendErrorResponse(
        res,
        new Error(
          `Invalid algorithm. Must be one of: ${validAlgorithms.join(", ")}`
        ),
        400
      );
    }

    // Validate features
    if (!Array.isArray(features) || features.length === 0) {
      return sendErrorResponse(
        res,
        new Error("Features must be a non-empty array"),
        400
      );
    }

    const inputData = {
      dataset_id: datasetId,
      features: features,
      algorithm: algorithm,
      parameters: parameters || {},
      analysis_config: {
        standardize: true,
        dimensionality_reduction: "pca",
        max_components: 10,
      },
    };

    const scriptPath = path.join(
      __dirname,
      "../../python-scripts/clustering_analysis.py"
    );

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 120000, // 2 minutes for clustering
      maxRetries: 2,
      onProgress: (progress) => {
        console.log("Clustering progress:", progress);
      },
    });

    // Validate clustering result
    if (!result || typeof result !== "object") {
      throw new PythonParseError("Invalid response from clustering script");
    }

    const requiredFields = ["clusters", "cluster_centers", "metrics"];
    const missingFields = requiredFields.filter(
      (field) => result[field] === undefined
    );
    if (missingFields.length > 0) {
      throw new PythonParseError(
        `Missing required fields in clustering result: ${missingFields.join(
          ", "
        )}`
      );
    }

    res.json({
      success: true,
      analysis: {
        type: "clustering",
        algorithm: algorithm,
        dataset_id: datasetId,
        results: result,
        execution_time: Date.now() - startTime,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Dimensionality reduction analysis endpoint
router.post("/dimensionality-reduction", async (req, res) => {
  const startTime = Date.now();

  try {
    const { datasetId, features, method, parameters } = req.body;

    // Enhanced input validation
    if (!datasetId || !features || !method) {
      return sendErrorResponse(
        res,
        new Error(
          "Missing required parameters: datasetId, features, and method"
        ),
        400
      );
    }

    // Validate method type
    const validMethods = ["pca", "tsne", "umap", "ica", "factor_analysis"];
    if (!validMethods.includes(method)) {
      return sendErrorResponse(
        res,
        new Error(`Invalid method. Must be one of: ${validMethods.join(", ")}`),
        400
      );
    }

    const inputData = {
      dataset_id: datasetId,
      features: features,
      method: method,
      parameters: parameters || {},
      analysis_config: {
        n_components: parameters?.n_components || 2,
        standardize: true,
      },
    };

    const scriptPath = path.join(
      __dirname,
      "../../python-scripts/dimensionality_reduction.py"
    );

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 90000, // 1.5 minutes
      maxRetries: 2,
    });

    // Validate result
    if (!result || typeof result !== "object") {
      throw new PythonParseError(
        "Invalid response from dimensionality reduction script"
      );
    }

    res.json({
      success: true,
      analysis: {
        type: "dimensionality_reduction",
        method: method,
        dataset_id: datasetId,
        results: result,
        execution_time: Date.now() - startTime,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Statistical analysis endpoint
router.post("/statistics", async (req, res) => {
  const startTime = Date.now();

  try {
    const { datasetId, features, analysisType } = req.body;

    // Enhanced input validation
    if (!datasetId || !features) {
      return sendErrorResponse(
        res,
        new Error("Missing required parameters: datasetId and features"),
        400
      );
    }

    // Validate analysis type
    const validAnalysisTypes = [
      "descriptive",
      "correlation",
      "distribution",
      "outlier_detection",
      "feature_importance",
    ];
    if (analysisType && !validAnalysisTypes.includes(analysisType)) {
      return sendErrorResponse(
        res,
        new Error(
          `Invalid analysis type. Must be one of: ${validAnalysisTypes.join(
            ", "
          )}`
        ),
        400
      );
    }

    const inputData = {
      dataset_id: datasetId,
      features: features,
      analysis_type: analysisType || "descriptive",
      config: {
        include_plots: true,
        confidence_level: 0.95,
      },
    };

    const scriptPath = path.join(
      __dirname,
      "../../python-scripts/statistical_analysis.py"
    );

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 60000, // 1 minute
      maxRetries: 2,
    });

    res.json({
      success: true,
      analysis: {
        type: "statistical",
        analysis_type: analysisType || "descriptive",
        dataset_id: datasetId,
        results: result,
        execution_time: Date.now() - startTime,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

module.exports = router;
