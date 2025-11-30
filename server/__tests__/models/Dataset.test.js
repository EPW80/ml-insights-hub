/**
 * Tests for Dataset model
 *
 * Validates:
 * - Schema constraints and required fields
 * - Enum validation (format)
 * - Array fields (columns, feature_columns, preprocessing_applied)
 * - Nested objects (data_quality_metrics)
 * - References (uploaded_by)
 * - Indexes
 * - Timestamps
 */

const mongoose = require('mongoose');
const Dataset = require('../../models/Dataset');
const User = require('../../models/User');

describe('Dataset Model', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await User.create({
      username: 'datasetowner',
      email: 'datasetowner@example.com',
      password: 'password123'
    });
  });

  describe('Schema Validation', () => {
    it('should create a dataset with valid data', async () => {
      const datasetData = {
        name: 'Housing Dataset',
        description: 'Real estate pricing data',
        file_path: '/data/housing.csv',
        format: 'csv',
        uploaded_by: testUser._id
      };

      const dataset = await Dataset.create(datasetData);

      expect(dataset._id).toBeDefined();
      expect(dataset.name).toBe(datasetData.name);
      expect(dataset.description).toBe(datasetData.description);
      expect(dataset.format).toBe(datasetData.format);
      expect(dataset.uploaded_by.toString()).toBe(testUser._id.toString());
    });

    it('should require name field', async () => {
      const dataset = new Dataset({
        description: 'Test dataset',
        format: 'csv'
      });

      await expect(dataset.save()).rejects.toThrow();
    });

    it('should allow optional description', async () => {
      const dataset = await Dataset.create({
        name: 'Test Dataset'
      });

      expect(dataset.description).toBeUndefined();
    });

    it('should allow optional file_path', async () => {
      const dataset = await Dataset.create({
        name: 'Test Dataset'
      });

      expect(dataset.file_path).toBeUndefined();
    });
  });

  describe('Enum Validation - Format', () => {
    it('should accept valid format: csv', async () => {
      const dataset = await Dataset.create({
        name: 'CSV Dataset',
        format: 'csv'
      });

      expect(dataset.format).toBe('csv');
    });

    it('should accept valid format: json', async () => {
      const dataset = await Dataset.create({
        name: 'JSON Dataset',
        format: 'json'
      });

      expect(dataset.format).toBe('json');
    });

    it('should accept valid format: excel', async () => {
      const dataset = await Dataset.create({
        name: 'Excel Dataset',
        format: 'excel'
      });

      expect(dataset.format).toBe('excel');
    });

    it('should accept valid format: parquet', async () => {
      const dataset = await Dataset.create({
        name: 'Parquet Dataset',
        format: 'parquet'
      });

      expect(dataset.format).toBe('parquet');
    });

    it('should reject invalid format', async () => {
      const dataset = new Dataset({
        name: 'Invalid Dataset',
        format: 'xml'
      });

      await expect(dataset.save()).rejects.toThrow();
    });
  });

  describe('Columns Array', () => {
    it('should allow empty columns array', async () => {
      const dataset = await Dataset.create({
        name: 'Empty Columns Dataset',
        columns: []
      });

      expect(dataset.columns).toHaveLength(0);
    });
  });

  describe('Feature and Target Columns', () => {
    it('should store target_column', async () => {
      const dataset = await Dataset.create({
        name: 'Target Dataset',
        target_column: 'price'
      });

      expect(dataset.target_column).toBe('price');
    });

    it('should store feature_columns array', async () => {
      const dataset = await Dataset.create({
        name: 'Features Dataset',
        feature_columns: ['bedrooms', 'bathrooms', 'sqft', 'year_built']
      });

      expect(dataset.feature_columns).toHaveLength(4);
      expect(dataset.feature_columns).toContain('bedrooms');
      expect(dataset.feature_columns).toContain('sqft');
    });
  });

  describe('Preprocessing Applied', () => {
    it('should track preprocessing operations', async () => {
      const dataset = await Dataset.create({
        name: 'Preprocessed Dataset',
        preprocessing_applied: [
          {
            operation: 'normalize',
            parameters: { method: 'min-max' },
            timestamp: new Date()
          },
          {
            operation: 'remove_outliers',
            parameters: { threshold: 3 },
            timestamp: new Date()
          }
        ]
      });

      expect(dataset.preprocessing_applied).toHaveLength(2);
      expect(dataset.preprocessing_applied[0].operation).toBe('normalize');
      expect(dataset.preprocessing_applied[0].parameters.method).toBe('min-max');
      expect(dataset.preprocessing_applied[1].operation).toBe('remove_outliers');
    });
  });

  describe('Data Quality Metrics', () => {
    it('should store quality metrics', async () => {
      const dataset = await Dataset.create({
        name: 'Quality Dataset',
        data_quality_metrics: {
          completeness: 0.95,
          validity: 0.98,
          uniqueness: 0.92,
          consistency: 0.96
        }
      });

      expect(dataset.data_quality_metrics.completeness).toBe(0.95);
      expect(dataset.data_quality_metrics.validity).toBe(0.98);
      expect(dataset.data_quality_metrics.uniqueness).toBe(0.92);
      expect(dataset.data_quality_metrics.consistency).toBe(0.96);
    });

    it('should allow undefined quality metrics', async () => {
      const dataset = await Dataset.create({
        name: 'No Quality Dataset'
      });

      // Mongoose initializes nested objects as empty objects
      expect(dataset.data_quality_metrics).toBeDefined();
    });
  });

  describe('File Metadata', () => {
    it('should store file_size', async () => {
      const dataset = await Dataset.create({
        name: 'Size Dataset',
        file_size: 1024000
      });

      expect(dataset.file_size).toBe(1024000);
    });

    it('should store row_count', async () => {
      const dataset = await Dataset.create({
        name: 'Rows Dataset',
        row_count: 5000
      });

      expect(dataset.row_count).toBe(5000);
    });
  });

  describe('User Reference', () => {
    it('should reference User model', async () => {
      const dataset = await Dataset.create({
        name: 'Referenced Dataset',
        uploaded_by: testUser._id
      });

      const populatedDataset = await Dataset.findById(dataset._id).populate('uploaded_by');

      expect(populatedDataset.uploaded_by._id.toString()).toBe(testUser._id.toString());
      expect(populatedDataset.uploaded_by.username).toBe('datasetowner');
    });

    it('should allow undefined uploaded_by', async () => {
      const dataset = await Dataset.create({
        name: 'Anonymous Dataset'
      });

      expect(dataset.uploaded_by).toBeUndefined();
    });
  });

  describe('Indexes', () => {
    it('should have index on name', async () => {
      const indexes = Dataset.schema.indexes();
      const nameIndex = indexes.find(idx => idx[0].name === 1);

      expect(nameIndex).toBeDefined();
    });

    it('should have text index on name and description', async () => {
      const indexes = Dataset.schema.indexes();
      const textIndex = indexes.find(idx => idx[0].name === 'text');

      expect(textIndex).toBeDefined();
    });

    it('should have index on format', async () => {
      const indexes = Dataset.schema.indexes();
      const formatIndex = indexes.find(idx => idx[0].format === 1);

      expect(formatIndex).toBeDefined();
    });

    it('should have index on uploaded_by', async () => {
      const indexes = Dataset.schema.indexes();
      const userIndex = indexes.find(idx => idx[0].uploaded_by === 1);

      expect(userIndex).toBeDefined();
    });

    it('should have index on createdAt', async () => {
      const indexes = Dataset.schema.indexes();
      const createdAtIndex = indexes.find(idx => idx[0].createdAt === -1);

      expect(createdAtIndex).toBeDefined();
    });
  });

  describe('Timestamps', () => {
    it('should automatically add createdAt timestamp', async () => {
      const dataset = await Dataset.create({
        name: 'Timestamp Dataset'
      });

      expect(dataset.createdAt).toBeDefined();
      expect(dataset.createdAt).toBeInstanceOf(Date);
    });

    it('should automatically add updatedAt timestamp', async () => {
      const dataset = await Dataset.create({
        name: 'Update Dataset'
      });

      expect(dataset.updatedAt).toBeDefined();
      expect(dataset.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt on modification', async () => {
      const dataset = await Dataset.create({
        name: 'Modify Dataset'
      });

      const originalUpdatedAt = dataset.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      dataset.description = 'Updated description';
      await dataset.save();

      expect(dataset.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Complex Dataset', () => {
    it('should create dataset with key fields populated', async () => {
      const dataset = await Dataset.create({
        name: 'Complete Housing Dataset',
        description: 'Comprehensive real estate data',
        file_path: '/uploads/housing_data.csv',
        file_size: 2048000,
        format: 'csv',
        row_count: 10000,
        target_column: 'price',
        feature_columns: ['bedrooms', 'bathrooms', 'sqft'],
        preprocessing_applied: [
          {
            operation: 'normalize',
            parameters: { method: 'standard' },
            timestamp: new Date()
          }
        ],
        data_quality_metrics: {
          completeness: 0.99,
          validity: 0.97,
          uniqueness: 0.95,
          consistency: 0.98
        },
        uploaded_by: testUser._id
      });

      expect(dataset.name).toBe('Complete Housing Dataset');
      expect(dataset.row_count).toBe(10000);
      expect(dataset.feature_columns).toHaveLength(3);
      expect(dataset.data_quality_metrics.completeness).toBe(0.99);
      expect(dataset.preprocessing_applied).toHaveLength(1);
    });
  });
});
