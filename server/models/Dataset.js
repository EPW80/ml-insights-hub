const mongoose = require('mongoose');

const datasetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  file_path: String,
  file_size: Number,
  format: {
    type: String,
    enum: ['csv', 'json', 'excel', 'parquet']
  },
  columns: [{
    name: String,
    type: String,
    nullable: Boolean,
    unique_values: Number,
    missing_count: Number,
    statistics: Object
  }],
  row_count: Number,
  target_column: String,
  feature_columns: [String],
  preprocessing_applied: [{
    operation: String,
    parameters: Object,
    timestamp: Date
  }],
  data_quality_metrics: {
    completeness: Number,
    validity: Number,
    uniqueness: Number,
    consistency: Number
  },
  uploaded_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying

// Index for searching datasets by name
datasetSchema.index({ name: 1 });

// Text search index for name and description
datasetSchema.index({ name: 'text', description: 'text' });

// Index for filtering by format
datasetSchema.index({ format: 1 });

// Index for filtering by uploader
datasetSchema.index({ uploaded_by: 1 });

// Index for recent datasets
datasetSchema.index({ createdAt: -1 });

// Compound index for user's datasets sorted by date
datasetSchema.index({ uploaded_by: 1, createdAt: -1 });

// Index for dataset size queries
datasetSchema.index({ file_size: 1 });
datasetSchema.index({ row_count: 1 });

// Index for quality metrics
datasetSchema.index({ 'data_quality_metrics.completeness': -1 });

// Compound index for high-quality recent datasets
datasetSchema.index({
  'data_quality_metrics.completeness': -1,
  createdAt: -1
});

module.exports = mongoose.model('Dataset', datasetSchema);
