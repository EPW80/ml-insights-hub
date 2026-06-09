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

const SCRIPT_PATH = path.join(__dirname, '../../python-scripts/model_explainability.py');

// Generate SHAP explanations
router.post('/shap', async (req, res) => {
  try {
    const { model_path, data, num_samples, feature_names } = req.body;

    const validationError = validateIdentifiers({ model_path });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }
    if (!data) {
      return res.status(400).json({ success: false, error: 'data is required' });
    }

    const inputData = {
      action: 'shap_explain',
      model_path,
      data,
      num_samples,
      feature_names,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 120000, // 2 minutes - SHAP can be slow
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Generate LIME explanations
router.post('/lime', async (req, res) => {
  try {
    const { model_path, data, instance_index, num_features, feature_names } = req.body;

    const validationError = validateIdentifiers({ model_path });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }
    if (!data) {
      return res.status(400).json({ success: false, error: 'data is required' });
    }

    const inputData = {
      action: 'lime_explain',
      model_path,
      data,
      instance_index,
      num_features,
      feature_names,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 60000, // 1 minute
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Compare feature importance methods
router.post('/importance-comparison', async (req, res) => {
  try {
    const { model_path, data, feature_names } = req.body;

    const validationError = validateIdentifiers({ model_path });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }
    if (!data) {
      return res.status(400).json({ success: false, error: 'data is required' });
    }

    const inputData = {
      action: 'compare_importance',
      model_path,
      data,
      feature_names,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 120000, // 2 minutes
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

module.exports = router;
