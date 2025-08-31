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

module.exports = mongoose.model('Dataset', datasetSchema);
