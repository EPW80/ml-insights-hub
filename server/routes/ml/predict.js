const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const Prediction = require('../../models/Prediction');
const { runPythonScript } = require('../../utils/pythonBridge');

router.post('/', async (req, res) => {
  try {
    const { features, modelType, uncertaintyMethod } = req.body;
    
    if (!features || !modelType) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const inputData = {
      features,
      model_type: modelType,
      uncertainty_method: uncertaintyMethod || 'ensemble',
      confidence_level: 0.95
    };

    const scriptPath = path.join(__dirname, '../../python-scripts/predict_with_uncertainty.py');
    const result = await runPythonScript(scriptPath, inputData);

    const prediction = new Prediction({
      property_features: features,
      model_type: modelType,
      prediction: {
        point_estimate: result.prediction,
        lower_bound: result.lower_bound,
        upper_bound: result.upper_bound,
        confidence_level: result.confidence_level,
        uncertainty_metrics: result.uncertainty_metrics
      },
      feature_importance: result.feature_importance,
      timestamp: new Date()
    });

    await prediction.save();

    res.json({
      success: true,
      prediction: prediction
    });

  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ error: 'Prediction failed', details: error.message });
  }
});

module.exports = router;
