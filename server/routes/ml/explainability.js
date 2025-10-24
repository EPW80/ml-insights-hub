const express = require("express");
const router = express.Router();
// Import authentication middleware
const { requireAuthOrApiKey, logAuthenticatedRequest } = require("../../middleware/mlAuth");

// Apply authentication to all routes in this router
router.use(requireAuthOrApiKey);
router.use(logAuthenticatedRequest);

const { runPythonScript } = require("../../utils/securePythonBridge");
const path = require("path");

// Generate SHAP explanations
router.post("/shap", async (req, res) => {
  try {
    const { model_path, data, num_samples, feature_names } = req.body;

    if (!model_path || !data) {
      return res.status(400).json({
        success: false,
        error: "model_path and data are required"
      });
    }

    const scriptPath = path.join(__dirname, "../../python-scripts/model_explainability.py");
    const inputData = {
      action: "shap_explain",
      model_path,
      data,
      num_samples,
      feature_names
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 120000 // 2 minutes - SHAP can be slow
    });

    res.json(result);

  } catch (error) {
    console.error("SHAP explanation error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate LIME explanations
router.post("/lime", async (req, res) => {
  try {
    const { model_path, data, instance_index, num_features, feature_names } = req.body;

    if (!model_path || !data) {
      return res.status(400).json({
        success: false,
        error: "model_path and data are required"
      });
    }

    const scriptPath = path.join(__dirname, "../../python-scripts/model_explainability.py");
    const inputData = {
      action: "lime_explain",
      model_path,
      data,
      instance_index,
      num_features,
      feature_names
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 60000 // 1 minute
    });

    res.json(result);

  } catch (error) {
    console.error("LIME explanation error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Compare feature importance methods
router.post("/importance-comparison", async (req, res) => {
  try {
    const { model_path, data, feature_names } = req.body;

    if (!model_path || !data) {
      return res.status(400).json({
        success: false,
        error: "model_path and data are required"
      });
    }

    const scriptPath = path.join(__dirname, "../../python-scripts/model_explainability.py");
    const inputData = {
      action: "compare_importance",
      model_path,
      data,
      feature_names
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 120000 // 2 minutes
    });

    res.json(result);

  } catch (error) {
    console.error("Feature importance comparison error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
