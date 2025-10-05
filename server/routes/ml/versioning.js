const express = require("express");
const router = express.Router();
const { runPythonScript } = require("../../utils/securePythonBridge");
const path = require("path");

// Create a new version of a model
router.post("/create", async (req, res) => {
  try {
    const { model_id, model_path, version_tag, metadata } = req.body;

    if (!model_id || !model_path) {
      return res.status(400).json({
        success: false,
        error: "model_id and model_path are required"
      });
    }

    const scriptPath = path.join(__dirname, "../../python-scripts/model_versioning.py");
    const inputData = {
      action: "create_version",
      model_id,
      model_path,
      version_tag,
      metadata
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 30000
    });

    res.json(result);

  } catch (error) {
    console.error("Version creation error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List all versions of a model
router.get("/list/:model_id", async (req, res) => {
  try {
    const { model_id } = req.params;

    const scriptPath = path.join(__dirname, "../../python-scripts/model_versioning.py");
    const inputData = {
      action: "list_versions",
      model_id
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 15000
    });

    res.json(result);

  } catch (error) {
    console.error("List versions error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get a specific version
router.get("/get/:model_id/:version_id", async (req, res) => {
  try {
    const { model_id, version_id } = req.params;

    const scriptPath = path.join(__dirname, "../../python-scripts/model_versioning.py");
    const inputData = {
      action: "get_version",
      model_id,
      version_id
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 15000
    });

    res.json(result);

  } catch (error) {
    console.error("Get version error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Rollback to a previous version
router.post("/rollback", async (req, res) => {
  try {
    const { model_id, version_id } = req.body;

    if (!model_id || !version_id) {
      return res.status(400).json({
        success: false,
        error: "model_id and version_id are required"
      });
    }

    const scriptPath = path.join(__dirname, "../../python-scripts/model_versioning.py");
    const inputData = {
      action: "rollback",
      model_id,
      version_id
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 30000
    });

    res.json(result);

  } catch (error) {
    console.error("Rollback error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Compare two versions
router.post("/compare", async (req, res) => {
  try {
    const { model_id, version_id_1, version_id_2 } = req.body;

    if (!model_id || !version_id_1 || !version_id_2) {
      return res.status(400).json({
        success: false,
        error: "model_id, version_id_1, and version_id_2 are required"
      });
    }

    const scriptPath = path.join(__dirname, "../../python-scripts/model_versioning.py");
    const inputData = {
      action: "compare_versions",
      model_id,
      version_id_1,
      version_id_2
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 30000
    });

    res.json(result);

  } catch (error) {
    console.error("Compare versions error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a version
router.delete("/:model_id/:version_id", async (req, res) => {
  try {
    const { model_id, version_id } = req.params;

    const scriptPath = path.join(__dirname, "../../python-scripts/model_versioning.py");
    const inputData = {
      action: "delete_version",
      model_id,
      version_id
    };

    const result = await runPythonScript(scriptPath, inputData, {
      timeout: 15000
    });

    res.json(result);

  } catch (error) {
    console.error("Delete version error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
