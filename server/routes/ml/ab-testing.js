const express = require('express');
const router = express.Router();
// Import authentication middleware
const { requireAuthOrApiKey, logAuthenticatedRequest } = require('../../middleware/mlAuth');

// Apply authentication to all routes in this router
router.use(requireAuthOrApiKey);
router.use(logAuthenticatedRequest);

const { runPythonScript } = require('../../utils/securePythonBridge');
const { sendRouteError } = require('../../utils/sendRouteError');
const { validateIdentifiers } = require('../../utils/validateMlParams');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '../../python-scripts/ab_testing.py');

// Create a new A/B test experiment
router.post('/create', async (req, res) => {
  try {
    const { experiment_name, model_a_path, model_b_path, description, traffic_split } = req.body;

    const validationError = validateIdentifiers({ experiment_name, model_a_path, model_b_path });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const inputData = {
      action: 'create_experiment',
      experiment_name,
      model_a_path,
      model_b_path,
      description,
      traffic_split,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 30000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Route a request to either model A or B
router.post('/route/:experiment_name', async (req, res) => {
  try {
    const { experiment_name } = req.params;

    const validationError = validateIdentifiers({ experiment_name });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const inputData = {
      action: 'route_request',
      experiment_name,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 15000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Record prediction results
router.post('/record', async (req, res) => {
  try {
    const { experiment_name, model_choice, predictions, actuals, metadata } = req.body;

    const validationError = validateIdentifiers({ experiment_name, model_choice });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }
    if (!predictions || !actuals) {
      return res.status(400).json({
        success: false,
        error: 'predictions and actuals are required',
      });
    }

    const inputData = {
      action: 'record_result',
      experiment_name,
      model_choice,
      predictions,
      actuals,
      metadata,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 30000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Analyze experiment results
router.get('/analyze/:experiment_name', async (req, res) => {
  try {
    const { experiment_name } = req.params;

    const validationError = validateIdentifiers({ experiment_name });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const confidence_level = parseFloat(req.query.confidence_level) || 0.95;

    const inputData = {
      action: 'analyze_experiment',
      experiment_name,
      confidence_level,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 60000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Stop an experiment
router.post('/stop/:experiment_name', async (req, res) => {
  try {
    const { experiment_name } = req.params;

    const validationError = validateIdentifiers({ experiment_name });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const inputData = {
      action: 'stop_experiment',
      experiment_name,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 15000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// List all experiments
router.get('/list', async (req, res) => {
  try {
    const inputData = {
      action: 'list_experiments',
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 15000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

module.exports = router;
