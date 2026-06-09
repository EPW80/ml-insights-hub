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

const SCRIPT_PATH = path.join(__dirname, '../../python-scripts/model_versioning.py');

// Create a new version of a model
router.post('/create', async (req, res) => {
  try {
    const { model_id, model_path, version_tag, metadata } = req.body;

    const validationError = validateIdentifiers({ model_id, model_path });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const inputData = {
      action: 'create_version',
      model_id,
      model_path,
      version_tag,
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

// List all versions of a model
router.get('/list/:model_id', async (req, res) => {
  try {
    const { model_id } = req.params;

    const validationError = validateIdentifiers({ model_id });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const inputData = {
      action: 'list_versions',
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

// Get a specific version
router.get('/get/:model_id/:version_id', async (req, res) => {
  try {
    const { model_id, version_id } = req.params;

    const validationError = validateIdentifiers({ model_id, version_id });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const inputData = {
      action: 'get_version',
      model_id,
      version_id,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 15000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Rollback to a previous version
router.post('/rollback', async (req, res) => {
  try {
    const { model_id, version_id } = req.body;

    const validationError = validateIdentifiers({ model_id, version_id });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const inputData = {
      action: 'rollback',
      model_id,
      version_id,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 30000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Compare two versions
router.post('/compare', async (req, res) => {
  try {
    const { model_id, version_id_1, version_id_2 } = req.body;

    const validationError = validateIdentifiers({ model_id, version_id_1, version_id_2 });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const inputData = {
      action: 'compare_versions',
      model_id,
      version_id_1,
      version_id_2,
    };

    const result = await runPythonScript(SCRIPT_PATH, inputData, {
      timeout: 30000,
    });

    return res.json(result);
  } catch (error) {
    return sendRouteError(res, error, 500, req);
  }
});

// Delete a version
router.delete('/:model_id/:version_id', async (req, res) => {
  try {
    const { model_id, version_id } = req.params;

    const validationError = validateIdentifiers({ model_id, version_id });
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const inputData = {
      action: 'delete_version',
      model_id,
      version_id,
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
