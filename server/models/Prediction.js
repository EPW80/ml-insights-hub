const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  property_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  },
  model_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Model'
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  property_features: {
    type: Object,
    required: true
  },
  model_type: String,
  prediction: {
    point_estimate: Number,
    lower_bound: Number,
    upper_bound: Number,
    confidence_level: Number,
    uncertainty_metrics: {
      std_deviation: Number,
      prediction_interval: [Number],
      quantiles: Object,
      coefficient_of_variation: Number
    }
  },
  feature_importance: [{
    feature: String,
    importance: Number
  }],
  model_confidence: Number,
  explanation: String
}, {
  timestamps: true
});

// Indexes for efficient querying

// Foreign key indexes for joins
predictionSchema.index({ property_id: 1 });
predictionSchema.index({ model_id: 1 });
predictionSchema.index({ user_id: 1 });

// Compound index for user's predictions sorted by date
predictionSchema.index({ user_id: 1, createdAt: -1 });

// Index for filtering by model type
predictionSchema.index({ model_type: 1 });

// Compound index for model performance analysis
predictionSchema.index({ model_id: 1, createdAt: -1 });

// Index for high-confidence predictions
predictionSchema.index({ model_confidence: -1 });

// Compound index for property + model lookups (prevent duplicate predictions)
predictionSchema.index({ property_id: 1, model_id: 1 });

// Index for prediction value range queries
predictionSchema.index({ 'prediction.point_estimate': 1 });

// Time-based queries (most recent predictions)
predictionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Prediction', predictionSchema);
