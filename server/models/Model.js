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

// Indexes for efficient querying

// Unique index on name (already declared in schema, but ensuring it's indexed)
modelSchema.index({ name: 1 }, { unique: true });

// Index for filtering by type and algorithm
modelSchema.index({ type: 1 });
modelSchema.index({ algorithm: 1 });
modelSchema.index({ type: 1, algorithm: 1 });

// Index for version queries
modelSchema.index({ version: 1 });

// Compound index for type + version (get latest version of each type)
modelSchema.index({ type: 1, version: -1 });

// Index for active models
modelSchema.index({ is_active: 1 });

// Compound index for active models by type
modelSchema.index({ is_active: 1, type: 1 });

// Index for performance-based queries (find best performing models)
modelSchema.index({ 'performance_metrics.r2_score': -1 });
modelSchema.index({ 'performance_metrics.rmse': 1 });

// Index for models by user
modelSchema.index({ created_by: 1 });

// Index for recent models
modelSchema.index({ createdAt: -1 });

// Compound index for filtering active models by performance
modelSchema.index({
  is_active: 1,
  'performance_metrics.r2_score': -1
});

module.exports = mongoose.model('Model', modelSchema);
