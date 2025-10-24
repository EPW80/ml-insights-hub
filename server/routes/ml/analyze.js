const express = require("express");
const router = express.Router();
// Import authentication middleware
const { requireAuthOrApiKey, logAuthenticatedRequest } = require("../../middleware/mlAuth");

// Apply authentication to all routes in this router
router.use(requireAuthOrApiKey);
router.use(logAuthenticatedRequest);

const {
  runPythonScript,
  executeDataValidation,
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
    console.error("🚨 SECURITY VIOLATION in Data Analysis:", {
      error: error.message,
      type: error.type,
      timestamp: error.timestamp
    });
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

// Feature Engineering endpoint
router.post("/feature-engineering", async (req, res) => {
  const startTime = Date.now();

  try {
    const { datasetId, features, engineeringMethods, parameters } = req.body;

    // Enhanced input validation
    if (!datasetId || !features) {
      return sendErrorResponse(
        res,
        new Error("Missing required parameters: datasetId and features"),
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

    // Validate engineering methods
    const validMethods = [
      "polynomial_features",
      "interaction_features",
      "log_transform",
      "sqrt_transform",
      "normalization",
      "standardization",
      "binning",
      "one_hot_encoding",
      "target_encoding",
      "feature_selection",
      "pca_features",
      "statistical_features"
    ];

    const methods = engineeringMethods || ["polynomial_features", "interaction_features"];
    const invalidMethods = methods.filter(method => !validMethods.includes(method));
    if (invalidMethods.length > 0) {
      return sendErrorResponse(
        res,
        new Error(`Invalid engineering methods: ${invalidMethods.join(", ")}. Valid methods: ${validMethods.join(", ")}`),
        400
      );
    }

    const inputData = {
      dataset_id: datasetId,
      features: features,
      engineering_methods: methods,
      parameters: parameters || {},
      config: {
        polynomial_degree: parameters?.polynomial_degree || 2,
        interaction_only: parameters?.interaction_only || false,
        normalize_features: parameters?.normalize_features || true,
        feature_selection_k: parameters?.feature_selection_k || 10,
        variance_threshold: parameters?.variance_threshold || 0.01
      }
    };

    const scriptPath = path.join(
      __dirname,
      "../../python-scripts/feature_engineering.py"
    );

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 120000, // 2 minutes for feature engineering
      maxRetries: 2,
      onProgress: (progress) => {
        console.log("Feature engineering progress:", progress);
      },
    });

    // Validate feature engineering result
    if (!result || typeof result !== "object") {
      throw new PythonParseError("Invalid response from feature engineering script");
    }

    const requiredFields = ["engineered_features", "feature_names", "transformation_info"];
    const missingFields = requiredFields.filter(
      (field) => result[field] === undefined
    );
    if (missingFields.length > 0) {
      throw new PythonParseError(
        `Missing required fields in feature engineering result: ${missingFields.join(
          ", "
        )}`
      );
    }

    res.json({
      success: true,
      analysis: {
        type: "feature_engineering",
        dataset_id: datasetId,
        original_features: features,
        engineering_methods: methods,
        results: result,
        execution_time: Date.now() - startTime,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    sendErrorResponse(res, error);
  }
});

// Anomaly Detection endpoint
router.post("/anomaly-detection", async (req, res) => {
  const startTime = Date.now();

  try {
    const { datasetId, features, algorithm, parameters } = req.body;

    // Enhanced input validation
    if (!datasetId || !features) {
      return sendErrorResponse(
        res,
        new Error("Missing required parameters: datasetId and features"),
        400
      );
    }

    // Validate algorithm type
    const validAlgorithms = [
      "isolation_forest",
      "one_class_svm",
      "local_outlier_factor",
      "elliptic_envelope",
      "statistical_outliers",
      "zscore",
      "iqr"
    ];
    const selectedAlgorithm = algorithm || "isolation_forest";
    if (!validAlgorithms.includes(selectedAlgorithm)) {
      return sendErrorResponse(
        res,
        new Error(
          `Invalid algorithm. Must be one of: ${validAlgorithms.join(", ")}`
        ),
        400
      );
    }

    const inputData = {
      dataset_id: datasetId,
      features: features,
      algorithm: selectedAlgorithm,
      parameters: parameters || {},
      config: {
        contamination: parameters?.contamination || 0.1,
        n_estimators: parameters?.n_estimators || 100,
        max_samples: parameters?.max_samples || "auto",
        threshold: parameters?.threshold || 3, // for statistical methods
        return_scores: true,
        visualize: true
      }
    };

    const scriptPath = path.join(
      __dirname,
      "../../python-scripts/anomaly_detection.py"
    );

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 90000, // 1.5 minutes
      maxRetries: 2,
    });

    // Validate anomaly detection result
    if (!result || typeof result !== "object") {
      throw new PythonParseError("Invalid response from anomaly detection script");
    }

    const requiredFields = ["anomalies", "anomaly_scores", "summary"];
    const missingFields = requiredFields.filter(
      (field) => result[field] === undefined
    );
    if (missingFields.length > 0) {
      throw new PythonParseError(
        `Missing required fields in anomaly detection result: ${missingFields.join(
          ", "
        )}`
      );
    }

    res.json({
      success: true,
      analysis: {
        type: "anomaly_detection",
        algorithm: selectedAlgorithm,
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

// Ensemble Models endpoint
router.post("/ensemble", async (req, res) => {
  const startTime = Date.now();

  try {
    const { datasetId, features, target, models, ensembleMethod, parameters } = req.body;

    // Enhanced input validation
    if (!datasetId || !features || !target) {
      return sendErrorResponse(
        res,
        new Error("Missing required parameters: datasetId, features, and target"),
        400
      );
    }

    // Validate ensemble method
    const validEnsembleMethods = [
      "voting",
      "bagging",
      "boosting",
      "stacking",
      "blending",
      "weighted_average"
    ];
    const selectedMethod = ensembleMethod || "voting";
    if (!validEnsembleMethods.includes(selectedMethod)) {
      return sendErrorResponse(
        res,
        new Error(
          `Invalid ensemble method. Must be one of: ${validEnsembleMethods.join(", ")}`
        ),
        400
      );
    }

    // Validate models
    const validModels = [
      "random_forest",
      "gradient_boosting",
      "svm",
      "logistic_regression",
      "naive_bayes",
      "knn",
      "decision_tree",
      "neural_network"
    ];
    const selectedModels = models || ["random_forest", "gradient_boosting", "svm"];
    const invalidModels = selectedModels.filter(model => !validModels.includes(model));
    if (invalidModels.length > 0) {
      return sendErrorResponse(
        res,
        new Error(`Invalid models: ${invalidModels.join(", ")}. Valid models: ${validModels.join(", ")}`),
        400
      );
    }

    const inputData = {
      dataset_id: datasetId,
      features: features,
      target: target,
      models: selectedModels,
      ensemble_method: selectedMethod,
      parameters: parameters || {},
      config: {
        test_size: parameters?.test_size || 0.2,
        random_state: parameters?.random_state || 42,
        cv_folds: parameters?.cv_folds || 5,
        scoring: parameters?.scoring || "accuracy",
        optimize_weights: parameters?.optimize_weights || true
      }
    };

    const scriptPath = path.join(
      __dirname,
      "../../python-scripts/ensemble_models.py"
    );

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 300000, // 5 minutes for ensemble training
      maxRetries: 2,
      onProgress: (progress) => {
        console.log("Ensemble training progress:", progress);
      },
    });

    // Validate ensemble result
    if (!result || typeof result !== "object") {
      throw new PythonParseError("Invalid response from ensemble script");
    }

    const requiredFields = ["ensemble_score", "individual_scores", "model_weights"];
    const missingFields = requiredFields.filter(
      (field) => result[field] === undefined
    );
    if (missingFields.length > 0) {
      throw new PythonParseError(
        `Missing required fields in ensemble result: ${missingFields.join(
          ", "
        )}`
      );
    }

    res.json({
      success: true,
      analysis: {
        type: "ensemble",
        ensemble_method: selectedMethod,
        models: selectedModels,
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

// Cross-Validation endpoint
router.post("/cross-validation", async (req, res) => {
  const startTime = Date.now();

  try {
    const { datasetId, features, target, model, cvMethod, parameters } = req.body;

    // Enhanced input validation
    if (!datasetId || !features || !target || !model) {
      return sendErrorResponse(
        res,
        new Error("Missing required parameters: datasetId, features, target, and model"),
        400
      );
    }

    // Validate CV method
    const validCvMethods = [
      "k_fold",
      "stratified_k_fold",
      "leave_one_out",
      "leave_p_out",
      "shuffle_split",
      "time_series_split",
      "group_k_fold"
    ];
    const selectedCvMethod = cvMethod || "k_fold";
    if (!validCvMethods.includes(selectedCvMethod)) {
      return sendErrorResponse(
        res,
        new Error(
          `Invalid CV method. Must be one of: ${validCvMethods.join(", ")}`
        ),
        400
      );
    }

    // Validate model
    const validModels = [
      "random_forest",
      "gradient_boosting",
      "svm",
      "logistic_regression",
      "linear_regression",
      "ridge",
      "lasso",
      "elastic_net",
      "naive_bayes",
      "knn",
      "decision_tree",
      "neural_network"
    ];
    if (!validModels.includes(model)) {
      return sendErrorResponse(
        res,
        new Error(`Invalid model. Must be one of: ${validModels.join(", ")}`),
        400
      );
    }

    const inputData = {
      dataset_id: datasetId,
      features: features,
      target: target,
      model: model,
      cv_method: selectedCvMethod,
      parameters: parameters || {},
      config: {
        cv_folds: parameters?.cv_folds || 5,
        scoring: parameters?.scoring || ["accuracy", "precision", "recall", "f1"],
        random_state: parameters?.random_state || 42,
        shuffle: parameters?.shuffle || true,
        return_train_score: parameters?.return_train_score || true,
        plot_learning_curve: parameters?.plot_learning_curve || true
      }
    };

    const scriptPath = path.join(
      __dirname,
      "../../python-scripts/cross_validation.py"
    );

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 180000, // 3 minutes for cross-validation
      maxRetries: 2,
      onProgress: (progress) => {
        console.log("Cross-validation progress:", progress);
      },
    });

    // Validate cross-validation result
    if (!result || typeof result !== "object") {
      throw new PythonParseError("Invalid response from cross-validation script");
    }

    const requiredFields = ["cv_scores", "mean_score", "std_score"];
    const missingFields = requiredFields.filter(
      (field) => result[field] === undefined
    );
    if (missingFields.length > 0) {
      throw new PythonParseError(
        `Missing required fields in cross-validation result: ${missingFields.join(
          ", "
        )}`
      );
    }

    res.json({
      success: true,
      analysis: {
        type: "cross_validation",
        cv_method: selectedCvMethod,
        model: model,
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
