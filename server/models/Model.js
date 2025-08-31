const mongoose = require('mongoose');

const modelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['regression', 'classification', 'clustering', 'anomaly_detection'],
    required: true
  },
  algorithm: {
    type: String,
    required: true
  },
  version: {
    type: String,
    default: '1.0.0'
  },
  hyperparameters: Object,
  performance_metrics: {
    rmse: Number,
    mae: Number,
    r2_score: Number,
    mape: Number,
    cross_val_scores: [Number],
    test_score: Number,
    training_score: Number
  },
  training_data: {
    dataset_id: String,
    dataset_name: String,
    sample_size: Number,
    features: [String],
    target_variable: String,
    train_test_split: Number
  },
  training_history: [{
    epoch: Number,
    loss: Number,
    val_loss: Number,
    metrics: Object,
    timestamp: Date
  }],
  model_file_path: String,
  scaler_file_path: String,
  feature_encoder_path: String,
  is_active: {
    type: Boolean,
    default: true
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Model', modelSchema);
