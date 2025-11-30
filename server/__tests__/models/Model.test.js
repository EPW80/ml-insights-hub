/**
 * Tests for Model model
 *
 * Validates:
 * - Schema constraints and required fields
 * - Unique constraints (name)
 * - Enum validation (type)
 * - Default values (version, is_active)
 * - Nested objects (performance_metrics, training_data)
 * - Array fields (training_history)
 * - References (created_by)
 * - Indexes
 * - Timestamps
 */

const mongoose = require('mongoose');
const Model = require('../../models/Model');
const User = require('../../models/User');

describe('Model Model', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await User.create({
      username: 'modelcreator',
      email: 'modelcreator@example.com',
      password: 'password123'
    });
  });

  describe('Schema Validation', () => {
    it('should create a model with valid data', async () => {
      const modelData = {
        name: 'Housing Price Predictor',
        type: 'regression',
        algorithm: 'linear_regression',
        created_by: testUser._id
      };

      const model = await Model.create(modelData);

      expect(model._id).toBeDefined();
      expect(model.name).toBe(modelData.name);
      expect(model.type).toBe(modelData.type);
      expect(model.algorithm).toBe(modelData.algorithm);
      expect(model.version).toBe('1.0.0'); // Default value
      expect(model.is_active).toBe(true); // Default value
    });

    it('should require name field', async () => {
      const model = new Model({
        type: 'regression',
        algorithm: 'linear_regression'
      });

      await expect(model.save()).rejects.toThrow();
    });

    it('should require type field', async () => {
      const model = new Model({
        name: 'Test Model',
        algorithm: 'linear_regression'
      });

      await expect(model.save()).rejects.toThrow();
    });

    it('should require algorithm field', async () => {
      const model = new Model({
        name: 'Test Model',
        type: 'regression'
      });

      await expect(model.save()).rejects.toThrow();
    });
  });

  describe('Unique Constraints', () => {
    beforeEach(async () => {
      await Model.create({
        name: 'Existing Model',
        type: 'regression',
        algorithm: 'linear_regression'
      });
    });

    it('should enforce unique name constraint', async () => {
      const duplicateModel = new Model({
        name: 'Existing Model',
        type: 'classification',
        algorithm: 'random_forest'
      });

      await expect(duplicateModel.save()).rejects.toThrow();
    });

    it('should allow different names', async () => {
      const model = await Model.create({
        name: 'Different Model',
        type: 'regression',
        algorithm: 'linear_regression'
      });

      expect(model.name).toBe('Different Model');
    });
  });

  describe('Enum Validation - Type', () => {
    it('should accept valid type: regression', async () => {
      const model = await Model.create({
        name: 'Regression Model',
        type: 'regression',
        algorithm: 'linear_regression'
      });

      expect(model.type).toBe('regression');
    });

    it('should accept valid type: classification', async () => {
      const model = await Model.create({
        name: 'Classification Model',
        type: 'classification',
        algorithm: 'logistic_regression'
      });

      expect(model.type).toBe('classification');
    });

    it('should accept valid type: clustering', async () => {
      const model = await Model.create({
        name: 'Clustering Model',
        type: 'clustering',
        algorithm: 'kmeans'
      });

      expect(model.type).toBe('clustering');
    });

    it('should accept valid type: anomaly_detection', async () => {
      const model = await Model.create({
        name: 'Anomaly Model',
        type: 'anomaly_detection',
        algorithm: 'isolation_forest'
      });

      expect(model.type).toBe('anomaly_detection');
    });

    it('should reject invalid type', async () => {
      const model = new Model({
        name: 'Invalid Type Model',
        type: 'prediction',
        algorithm: 'test_algorithm'
      });

      await expect(model.save()).rejects.toThrow();
    });
  });

  describe('Default Values', () => {
    it('should set default version to 1.0.0', async () => {
      const model = await Model.create({
        name: 'Version Test Model',
        type: 'regression',
        algorithm: 'linear_regression'
      });

      expect(model.version).toBe('1.0.0');
    });

    it('should allow custom version', async () => {
      const model = await Model.create({
        name: 'Custom Version Model',
        type: 'regression',
        algorithm: 'linear_regression',
        version: '2.1.5'
      });

      expect(model.version).toBe('2.1.5');
    });

    it('should set default is_active to true', async () => {
      const model = await Model.create({
        name: 'Active Test Model',
        type: 'regression',
        algorithm: 'linear_regression'
      });

      expect(model.is_active).toBe(true);
    });

    it('should allow setting is_active to false', async () => {
      const model = await Model.create({
        name: 'Inactive Model',
        type: 'regression',
        algorithm: 'linear_regression',
        is_active: false
      });

      expect(model.is_active).toBe(false);
    });
  });

  describe('Hyperparameters', () => {
    it('should store hyperparameters as object', async () => {
      const model = await Model.create({
        name: 'Hyperparameter Model',
        type: 'regression',
        algorithm: 'random_forest',
        hyperparameters: {
          n_estimators: 100,
          max_depth: 10,
          min_samples_split: 2,
          learning_rate: 0.01
        }
      });

      expect(model.hyperparameters.n_estimators).toBe(100);
      expect(model.hyperparameters.max_depth).toBe(10);
      expect(model.hyperparameters.learning_rate).toBe(0.01);
    });
  });

  describe('Performance Metrics', () => {
    it('should store performance metrics', async () => {
      const model = await Model.create({
        name: 'Performance Model',
        type: 'regression',
        algorithm: 'linear_regression',
        performance_metrics: {
          rmse: 25000,
          mae: 18000,
          r2_score: 0.85,
          mape: 12.5,
          test_score: 0.82,
          training_score: 0.88
        }
      });

      expect(model.performance_metrics.rmse).toBe(25000);
      expect(model.performance_metrics.mae).toBe(18000);
      expect(model.performance_metrics.r2_score).toBe(0.85);
      expect(model.performance_metrics.mape).toBe(12.5);
    });

    it('should store cross validation scores', async () => {
      const model = await Model.create({
        name: 'Cross Val Model',
        type: 'regression',
        algorithm: 'ridge_regression',
        performance_metrics: {
          cross_val_scores: [0.81, 0.83, 0.85, 0.82, 0.84]
        }
      });

      expect(model.performance_metrics.cross_val_scores).toHaveLength(5);
      expect(model.performance_metrics.cross_val_scores[2]).toBe(0.85);
    });
  });

  describe('Training Data', () => {
    it('should store training data metadata', async () => {
      const model = await Model.create({
        name: 'Training Data Model',
        type: 'regression',
        algorithm: 'linear_regression',
        training_data: {
          dataset_id: 'dataset_123',
          dataset_name: 'Housing Dataset',
          sample_size: 10000,
          features: ['bedrooms', 'bathrooms', 'sqft'],
          target_variable: 'price',
          train_test_split: 0.8
        }
      });

      expect(model.training_data.dataset_id).toBe('dataset_123');
      expect(model.training_data.dataset_name).toBe('Housing Dataset');
      expect(model.training_data.sample_size).toBe(10000);
      expect(model.training_data.features).toHaveLength(3);
      expect(model.training_data.target_variable).toBe('price');
    });
  });

  describe('Training History', () => {
    it('should track training history', async () => {
      const model = await Model.create({
        name: 'History Model',
        type: 'classification',
        algorithm: 'neural_network',
        training_history: [
          {
            epoch: 1,
            loss: 0.5,
            val_loss: 0.55,
            metrics: { accuracy: 0.75 },
            timestamp: new Date('2024-01-01')
          },
          {
            epoch: 2,
            loss: 0.4,
            val_loss: 0.45,
            metrics: { accuracy: 0.80 },
            timestamp: new Date('2024-01-02')
          }
        ]
      });

      expect(model.training_history).toHaveLength(2);
      expect(model.training_history[0].epoch).toBe(1);
      expect(model.training_history[0].loss).toBe(0.5);
      expect(model.training_history[1].metrics.accuracy).toBe(0.80);
    });
  });

  describe('File Paths', () => {
    it('should store model file paths', async () => {
      const model = await Model.create({
        name: 'File Path Model',
        type: 'regression',
        algorithm: 'xgboost',
        model_file_path: '/models/xgboost_model.pkl',
        scaler_file_path: '/scalers/standard_scaler.pkl',
        feature_encoder_path: '/encoders/label_encoder.pkl'
      });

      expect(model.model_file_path).toBe('/models/xgboost_model.pkl');
      expect(model.scaler_file_path).toBe('/scalers/standard_scaler.pkl');
      expect(model.feature_encoder_path).toBe('/encoders/label_encoder.pkl');
    });
  });

  describe('User Reference', () => {
    it('should reference User model', async () => {
      const model = await Model.create({
        name: 'Referenced Model',
        type: 'regression',
        algorithm: 'linear_regression',
        created_by: testUser._id
      });

      const populatedModel = await Model.findById(model._id).populate('created_by');

      expect(populatedModel.created_by._id.toString()).toBe(testUser._id.toString());
      expect(populatedModel.created_by.username).toBe('modelcreator');
    });

    it('should allow undefined created_by', async () => {
      const model = await Model.create({
        name: 'Anonymous Model',
        type: 'regression',
        algorithm: 'linear_regression'
      });

      expect(model.created_by).toBeUndefined();
    });
  });

  describe('Indexes', () => {
    it('should have unique index on name', async () => {
      const indexes = Model.schema.indexes();
      const nameIndex = indexes.find(idx => idx[0].name === 1 && idx[1]?.unique === true);

      expect(nameIndex).toBeDefined();
    });

    it('should have index on type', async () => {
      const indexes = Model.schema.indexes();
      const typeIndex = indexes.find(idx => idx[0].type === 1);

      expect(typeIndex).toBeDefined();
    });

    it('should have index on algorithm', async () => {
      const indexes = Model.schema.indexes();
      const algorithmIndex = indexes.find(idx => idx[0].algorithm === 1);

      expect(algorithmIndex).toBeDefined();
    });

    it('should have index on is_active', async () => {
      const indexes = Model.schema.indexes();
      const activeIndex = indexes.find(idx => idx[0].is_active === 1);

      expect(activeIndex).toBeDefined();
    });

    it('should have index on created_by', async () => {
      const indexes = Model.schema.indexes();
      const userIndex = indexes.find(idx => idx[0].created_by === 1);

      expect(userIndex).toBeDefined();
    });
  });

  describe('Timestamps', () => {
    it('should automatically add createdAt timestamp', async () => {
      const model = await Model.create({
        name: 'Timestamp Model',
        type: 'regression',
        algorithm: 'linear_regression'
      });

      expect(model.createdAt).toBeDefined();
      expect(model.createdAt).toBeInstanceOf(Date);
    });

    it('should automatically add updatedAt timestamp', async () => {
      const model = await Model.create({
        name: 'Update Model',
        type: 'regression',
        algorithm: 'linear_regression'
      });

      expect(model.updatedAt).toBeDefined();
      expect(model.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt on modification', async () => {
      const model = await Model.create({
        name: 'Modify Model',
        type: 'regression',
        algorithm: 'linear_regression'
      });

      const originalUpdatedAt = model.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      model.version = '2.0.0';
      await model.save();

      expect(model.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Complete Model', () => {
    it('should create model with all fields populated', async () => {
      const model = await Model.create({
        name: 'Complete Housing Model',
        type: 'regression',
        algorithm: 'gradient_boosting',
        version: '2.1.0',
        hyperparameters: {
          n_estimators: 200,
          learning_rate: 0.05,
          max_depth: 8
        },
        performance_metrics: {
          rmse: 22000,
          mae: 16000,
          r2_score: 0.88,
          mape: 10.5,
          cross_val_scores: [0.85, 0.87, 0.89, 0.86, 0.88],
          test_score: 0.87,
          training_score: 0.91
        },
        training_data: {
          dataset_id: 'dataset_456',
          dataset_name: 'Complete Housing Dataset',
          sample_size: 15000,
          features: ['bedrooms', 'bathrooms', 'sqft', 'year_built'],
          target_variable: 'price',
          train_test_split: 0.75
        },
        training_history: [
          {
            epoch: 1,
            loss: 0.3,
            val_loss: 0.35,
            metrics: { r2: 0.80 },
            timestamp: new Date()
          }
        ],
        model_file_path: '/models/gradient_boosting.pkl',
        scaler_file_path: '/scalers/scaler.pkl',
        feature_encoder_path: '/encoders/encoder.pkl',
        is_active: true,
        created_by: testUser._id
      });

      expect(model.name).toBe('Complete Housing Model');
      expect(model.hyperparameters.n_estimators).toBe(200);
      expect(model.performance_metrics.r2_score).toBe(0.88);
      expect(model.training_data.sample_size).toBe(15000);
      expect(model.is_active).toBe(true);
    });
  });
});
