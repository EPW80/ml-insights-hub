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

module.exports = mongoose.model('Prediction', predictionSchema);
