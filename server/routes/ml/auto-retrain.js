const express = require("express");
const router = express.Router();
// Import authentication middleware
const { requireAuthOrApiKey, logAuthenticatedRequest } = require("../../middleware/mlAuth");

// Apply authentication to all routes in this router
router.use(requireAuthOrApiKey);
router.use(logAuthenticatedRequest);

const { runPythonScript } = require("../../utils/securePythonBridge");
const path = require("path");

// Configure monitoring for a model
router.post("/configure", async (req, res) => {
  try {
    const { model_id, thresholds, monitoring_config } = req.body;

    if (!model_id || !thresholds) {
      return res.status(400).json({
        success: false,
        error: "model_id and thresholds are required"
      });
    }

    const scriptPath = path.join(__dirname, "../../python-scripts/auto_retrain.py");
    const inputData = {
      action: "configure",
      model_id,
      thresholds,
      monitoring_config
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 30000
    });

    res.json(result);

  } catch (error) {
    console.error("Configure monitoring error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check model performance against thresholds
router.post("/check-performance", async (req, res) => {
  try {
    const { model_id, current_metrics, baseline_metrics } = req.body;

    if (!model_id || !current_metrics) {
      return res.status(400).json({
        success: false,
        error: "model_id and current_metrics are required"
      });
    }

    const scriptPath = path.join(__dirname, "../../python-scripts/auto_retrain.py");
    const inputData = {
      action: "check_performance",
      model_id,
      current_metrics,
      baseline_metrics
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 30000
    });

    res.json(result);

  } catch (error) {
    console.error("Check performance error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Trigger model retraining
router.post("/trigger", async (req, res) => {
  try {
    const { model_id, retrain_params } = req.body;

    if (!model_id) {
      return res.status(400).json({
        success: false,
        error: "model_id is required"
      });
    }

    const scriptPath = path.join(__dirname, "../../python-scripts/auto_retrain.py");
    const inputData = {
      action: "trigger_retrain",
      model_id,
      retrain_params
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 30000
    });

    res.json(result);

  } catch (error) {
    console.error("Trigger retrain error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get monitoring status for a model
router.get("/status/:model_id", async (req, res) => {
  try {
    const { model_id } = req.params;

    const scriptPath = path.join(__dirname, "../../python-scripts/auto_retrain.py");
    const inputData = {
      action: "get_status",
      model_id
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 15000
    });

    res.json(result);

  } catch (error) {
    console.error("Get status error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update monitoring configuration
router.patch("/config/:model_id", async (req, res) => {
  try {
    const { model_id } = req.params;
    const { updates } = req.body;

    if (!updates) {
      return res.status(400).json({
        success: false,
        error: "updates object is required"
      });
    }

    const scriptPath = path.join(__dirname, "../../python-scripts/auto_retrain.py");
    const inputData = {
      action: "update_config",
      model_id,
      updates
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 15000
    });

    res.json(result);

  } catch (error) {
    console.error("Update config error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List all monitored models
router.get("/list", async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, "../../python-scripts/auto_retrain.py");
    const inputData = {
      action: "list_models"
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 15000
    });

    res.json(result);

  } catch (error) {
    console.error("List models error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
