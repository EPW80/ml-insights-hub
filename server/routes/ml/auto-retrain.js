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

const SCRIPT_PATH = path.join(__dirname, '../../python-scripts/auto_retrain.py');

// Configure monitoring for a model
router.post('/configure', async (req, res) => {
  try {
    const { model_id, thresholds, monitoring_config } = req.body;

    const validationError = validateIdentifiers({ model_id });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }
    if (!thresholds) {
      return res.status(400).json({ success: false, error: 'thresholds are required' });
    }

    const inputData = {
      action: 'configure',
      model_id,
      thresholds,
      monitoring_config,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 30000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Check model performance against thresholds
router.post('/check-performance', async (req, res) => {
  try {
    const { model_id, current_metrics, baseline_metrics } = req.body;

    const validationError = validateIdentifiers({ model_id });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }
    if (!current_metrics) {
      return res.status(400).json({ success: false, error: 'current_metrics are required' });
    }

    const inputData = {
      action: 'check_performance',
      model_id,
      current_metrics,
      baseline_metrics,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 30000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Trigger model retraining
router.post('/trigger', async (req, res) => {
  try {
    const { model_id, retrain_params } = req.body;

    const validationError = validateIdentifiers({ model_id });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const inputData = {
      action: 'trigger_retrain',
      model_id,
      retrain_params,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 30000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Get monitoring status for a model
router.get('/status/:model_id', async (req, res) => {
  try {
    const { model_id } = req.params;

    const validationError = validateIdentifiers({ model_id });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const inputData = {
      action: 'get_status',
      model_id,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 15000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Update monitoring configuration
router.patch('/config/:model_id', async (req, res) => {
  try {
    const { model_id } = req.params;
    const { updates } = req.body;

    const validationError = validateIdentifiers({ model_id });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }
    if (!updates) {
      return res.status(400).json({ success: false, error: 'updates object is required' });
    }

    const inputData = {
      action: 'update_config',
      model_id,
      updates,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 15000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// List all monitored models
router.get('/list', async (req, res) => {
  try {
    const inputData = {
      action: 'list_models',
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
