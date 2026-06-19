const { executeMlPrediction } = require('./securePythonBridge');
const logger = require('../config/logger');

// Model types whose base (residual-path) model is cheap to train and covers the
// default prediction path. Bootstrap ensembles stay lazy (trained on first use).
const WARMUP_MODEL_TYPES = [
  'linear_regression',
  'random_forest',
  'gradient_boosting',
  'neural_network',
];

// Minimal feature set just to trigger a train-and-cache; values are irrelevant
// since warmup only cares about populating the model cache.
const WARMUP_FEATURES = {
  bedrooms: 3,
  bathrooms: 2,
  sqft: 1800,
  year_built: 2005,
};

/**
 * Pre-train and cache each base model after startup so the first real
 * prediction request doesn't pay the cold train + sklearn import cost.
 * Runs sequentially in the background; failures are logged but never throw,
 * so a warmup problem can't take the server down.
 */
async function warmModelCache() {
  if (process.env.DISABLE_MODEL_WARMUP === 'true') {
    logger.info('Model cache warmup skipped (DISABLE_MODEL_WARMUP=true)');
    return;
  }

  logger.info('Warming model cache in background...');
  const started = Date.now();

  for (const modelType of WARMUP_MODEL_TYPES) {
    try {
      await executeMlPrediction(WARMUP_FEATURES, modelType, 'ensemble');
      logger.info(`Model cache warmed: ${modelType}`);
    } catch (error) {
      logger.warn(`Model cache warmup failed for ${modelType}: ${error.message}`);
    }
  }

  logger.info(`Model cache warmup complete in ${Date.now() - started}ms`);
}

module.exports = { warmModelCache };
