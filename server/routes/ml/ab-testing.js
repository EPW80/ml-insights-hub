const express = require("express");
const router = express.Router();
// Import authentication middleware
const { requireAuthOrApiKey, logAuthenticatedRequest } = require("../../middleware/mlAuth");

// Apply authentication to all routes in this router
router.use(requireAuthOrApiKey);
router.use(logAuthenticatedRequest);

const { runPythonScript } = require("../../utils/securePythonBridge");
const path = require("path");

// Create a new A/B test experiment
router.post("/create", async (req, res) => {
  try {
    const { experiment_name, model_a_path, model_b_path, description, traffic_split } = req.body;

    if (!experiment_name || !model_a_path || !model_b_path) {
      return res.status(400).json({
        success: false,
        error: "experiment_name, model_a_path, and model_b_path are required"
      });
    }

    const scriptPath = path.join(__dirname, "../../python-scripts/ab_testing.py");
    const inputData = {
      action: "create_experiment",
      experiment_name,
      model_a_path,
      model_b_path,
      description,
      traffic_split
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 30000
    });

    res.json(result);

  } catch (error) {
    console.error("Create experiment error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route a request to either model A or B
router.post("/route/:experiment_name", async (req, res) => {
  try {
    const { experiment_name } = req.params;

    const scriptPath = path.join(__dirname, "../../python-scripts/ab_testing.py");
    const inputData = {
      action: "route_request",
      experiment_name
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 15000
    });

    res.json(result);

  } catch (error) {
    console.error("Route request error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Record prediction results
router.post("/record", async (req, res) => {
  try {
    const { experiment_name, model_choice, predictions, actuals, metadata } = req.body;

    if (!experiment_name || !model_choice || !predictions || !actuals) {
      return res.status(400).json({
        success: false,
        error: "experiment_name, model_choice, predictions, and actuals are required"
      });
    }

    const scriptPath = path.join(__dirname, "../../python-scripts/ab_testing.py");
    const inputData = {
      action: "record_result",
      experiment_name,
      model_choice,
      predictions,
      actuals,
      metadata
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 30000
    });

    res.json(result);

  } catch (error) {
    console.error("Record result error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Analyze experiment results
router.get("/analyze/:experiment_name", async (req, res) => {
  try {
    const { experiment_name } = req.params;
    const confidence_level = parseFloat(req.query.confidence_level) || 0.95;

    const scriptPath = path.join(__dirname, "../../python-scripts/ab_testing.py");
    const inputData = {
      action: "analyze_experiment",
      experiment_name,
      confidence_level
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 60000
    });

    res.json(result);

  } catch (error) {
    console.error("Analyze experiment error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop an experiment
router.post("/stop/:experiment_name", async (req, res) => {
  try {
    const { experiment_name } = req.params;

    const scriptPath = path.join(__dirname, "../../python-scripts/ab_testing.py");
    const inputData = {
      action: "stop_experiment",
      experiment_name
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 15000
    });

    res.json(result);

  } catch (error) {
    console.error("Stop experiment error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List all experiments
router.get("/list", async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, "../../python-scripts/ab_testing.py");
    const inputData = {
      action: "list_experiments"
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 15000
    });

    res.json(result);

  } catch (error) {
    console.error("List experiments error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
