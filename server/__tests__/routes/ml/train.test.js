/**
 * Tests for ML Training Routes
 *
 * Validates:
 * - Authentication requirements (requireAuthOrApiKey)
 * - Input validation (modelType, datasetId, hyperparameters)
 * - Successful model training and database storage
 * - Python bridge error handling (execution, timeout, security errors)
 * - Streaming vs non-streaming training modes
 * - Training status endpoint
 * - Model document creation and storage
 * - Dataset reference validation
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Model = require('../../../models/Model');
const Dataset = require('../../../models/Dataset');
const User = require('../../../models/User');
const jwt = require('jsonwebtoken');

// Mock the securePythonBridge module
jest.mock('../../../utils/securePythonBridge', () => ({
  runPythonScript: jest.fn(),
  PythonExecutionError: class PythonExecutionError extends Error {
    constructor(message, details = {}) {
      super(message);
      this.name = 'PythonExecutionError';
      this.details = details;
    }
  },
  PythonTimeoutError: class PythonTimeoutError extends Error {
    constructor(message, details = {}) {
      super(message);
      this.name = 'PythonTimeoutError';
      this.details = details;
    }
  },
  PythonSecurityError: class PythonSecurityError extends Error {
    constructor(message, details = {}) {
      super(message);
      this.name = 'PythonSecurityError';
      this.details = details;
    }
  }
}));

const { runPythonScript, PythonExecutionError, PythonTimeoutError, PythonSecurityError } = require('../../../utils/securePythonBridge');

// Set up environment before loading routes
process.env.JWT_SECRET = 'test-secret-key-for-ml-routes';
process.env.SKIP_AUTH = 'false'; // Enforce auth for these tests

describe('ML Training Routes', () => {
  let app;
  let testUser;
  let testDataset;
  let validToken;

  beforeAll(() => {
    // Create Express app with routes
    app = express();
    app.use(express.json());

    // Mount the ML routes
    app.use('/api/ml/train', require('../../../routes/ml/train'));
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create test user
    testUser = await User.create({
      username: 'trainer',
      email: 'trainer@example.com',
      password: 'password123'
    });

    // Create test dataset
    testDataset = await Dataset.create({
      name: 'Training Dataset',
      format: 'csv',
      file_path: '/data/training.csv',
      row_count: 1000,
      feature_columns: ['bedrooms', 'bathrooms', 'sqft'],
      target_column: 'price',
      uploaded_by: testUser._id
    });

    // Generate valid JWT token
    validToken = jwt.sign(
      { id: testUser._id, email: testUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Set up default mock for runPythonScript
    runPythonScript.mockResolvedValue({
      model_id: new mongoose.Types.ObjectId().toString(),
      metrics: {
        r2_score: 0.85,
        mse: 1200,
        mae: 850,
        rmse: 1095
      },
      training_time: 45.2,
      model_path: '/models/test_model.pkl',
      features: ['bedrooms', 'bathrooms', 'sqft'],
      target_variable: 'price',
      sample_size: 800
    });
  });

  describe('POST /api/ml/train - Authentication', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/ml/train')
        .send({
          modelType: 'linear_regression',
          datasetId: testDataset._id.toString()
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should accept valid JWT token', async () => {
      // Uses default mock from beforeEach
      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression',
          datasetId: testDataset._id.toString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid JWT token', async () => {
      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          modelType: 'linear_regression',
          datasetId: testDataset._id.toString()
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/ml/train - Input Validation', () => {
    it('should require modelType', async () => {
      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          datasetId: testDataset._id.toString()
        })
        .expect(400);

      expect(response.body.error).toContain('modelType');
    });

    it('should require datasetId', async () => {
      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression'
        })
        .expect(400);

      expect(response.body.error).toContain('datasetId');
    });

    it('should validate modelType is valid', async () => {
      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'invalid_model',
          datasetId: testDataset._id.toString()
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid model type');
    });

    it('should accept valid modelType: linear_regression', async () => {
      // Uses default mock from beforeEach
      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression',
          datasetId: testDataset._id.toString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept valid modelType: random_forest', async () => {
      // Uses default mock from beforeEach
      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'random_forest',
          datasetId: testDataset._id.toString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept valid modelType: gradient_boosting', async () => {
      // Uses default mock from beforeEach
      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'gradient_boosting',
          datasetId: testDataset._id.toString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should accept valid modelType: neural_network', async () => {
      // Uses default mock from beforeEach
      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'neural_network',
          datasetId: testDataset._id.toString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate datasetId is valid ObjectId', async () => {
      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression',
          datasetId: 'invalid-id'
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate dataset exists', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression',
          datasetId: nonExistentId.toString()
        })
        .expect(404);

      expect(response.body.error).toContain('Dataset not found');
    });

    it('should accept optional hyperparameters as object', async () => {
      runPythonScript.mockResolvedValue({
        model_id: new mongoose.Types.ObjectId().toString(),
        metrics: { r2_score: 0.91 },
        training_time: 45.2,
        model_path: '/models/test_model.pkl',
        features: ['bedrooms', 'bathrooms', 'sqft'],
        target_variable: 'price',
        sample_size: 800
      });

      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'random_forest',
          datasetId: testDataset._id.toString(),
          hyperparameters: {
            n_estimators: 100,
            max_depth: 10,
            min_samples_split: 2
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // runPythonScript is called with (scriptPath, inputData, options)
      expect(runPythonScript).toHaveBeenCalled();
      const callArgs = runPythonScript.mock.calls[runPythonScript.mock.calls.length - 1];
      expect(callArgs[1].hyperparameters).toEqual({
        n_estimators: 100,
        max_depth: 10,
        min_samples_split: 2
      });
    });

    it('should reject hyperparameters if not an object', async () => {
      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression',
          datasetId: testDataset._id.toString(),
          hyperparameters: 'invalid'
        })
        .expect(400);

      expect(response.body.error).toContain('Hyperparameters');
    });

    it('should accept optional stream parameter', async () => {
      // Uses default mock from beforeEach
      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression',
          datasetId: testDataset._id.toString(),
          stream: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/ml/train - Successful Training', () => {
    it('should train model and store in database', async () => {
      const mockModelId = new mongoose.Types.ObjectId().toString();
      const mockMetrics = {
        r2_score: 0.87,
        mse: 1500,
        mae: 900,
        rmse: 1224
      };

      runPythonScript.mockResolvedValue({
        model_id: mockModelId,
        metrics: mockMetrics,
        training_time: 45.2,
        model_path: '/models/test_model.pkl',
        features: ['bedrooms', 'bathrooms', 'sqft'],
        target_variable: 'price',
        sample_size: 800,
        feature_importance: [
          { feature: 'sqft', importance: 0.5 },
          { feature: 'bedrooms', importance: 0.3 }
        ]
      });

      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression',
          datasetId: testDataset._id.toString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.model).toBeDefined();
      expect(response.body.model.type).toBe('regression');
      expect(response.body.model.algorithm).toBe('linear_regression');
      expect(response.body.model.performance_metrics.r2_score).toBe(0.87);

      // Verify model was saved to database
      const savedModel = await Model.findOne({ algorithm: 'linear_regression' });
      expect(savedModel).toBeDefined();
      expect(savedModel.training_data.dataset_id).toBe(testDataset._id.toString());
      expect(savedModel.performance_metrics.r2_score).toBe(0.87);
    });

    it('should include dataset reference in saved model', async () => {
      // Uses default mock from beforeEach
      await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'random_forest',
          datasetId: testDataset._id.toString()
        })
        .expect(200);

      const savedModel = await Model.findOne({ algorithm: 'random_forest' });
      expect(savedModel.training_data.dataset_id).toBe(testDataset._id.toString());
    });

    it('should store hyperparameters in model document', async () => {
      const hyperparameters = {
        n_estimators: 150,
        max_depth: 12
      };

      runPythonScript.mockResolvedValue({
        model_id: new mongoose.Types.ObjectId().toString(),
        metrics: { r2_score: 0.91 },
        training_time: 45.2,
        model_path: '/models/test_model.pkl',
        features: ['bedrooms', 'bathrooms', 'sqft'],
        target_variable: 'price',
        sample_size: 800,
        hyperparameters: hyperparameters
      });

      await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'random_forest',
          datasetId: testDataset._id.toString(),
          hyperparameters: hyperparameters
        })
        .expect(200);

      const savedModel = await Model.findOne({ algorithm: 'random_forest' });
      expect(savedModel.hyperparameters).toEqual(hyperparameters);
    });

    it('should set model as active by default', async () => {
      // Uses default mock from beforeEach
      await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression',
          datasetId: testDataset._id.toString()
        })
        .expect(200);

      const savedModel = await Model.findOne({ algorithm: 'linear_regression' });
      expect(savedModel.is_active).toBe(true);
    });

    it('should return complete model information', async () => {
      runPythonScript.mockResolvedValue({
        model_id: new mongoose.Types.ObjectId().toString(),
        metrics: {
          r2_score: 0.93,
          mse: 800,
          mae: 600
        },
        training_time: 45.2,
        model_path: '/models/test_model.pkl',
        features: ['bedrooms', 'bathrooms', 'sqft'],
        target_variable: 'price',
        sample_size: 800,
        feature_importance: [
          { feature: 'sqft', importance: 0.6 },
          { feature: 'bedrooms', importance: 0.25 },
          { feature: 'bathrooms', importance: 0.15 }
        ]
      });

      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'gradient_boosting',
          datasetId: testDataset._id.toString()
        })
        .expect(200);

      expect(response.body.model.name).toBeDefined();
      expect(response.body.model.type).toBe('regression');
      expect(response.body.model.algorithm).toBe('gradient_boosting');
      expect(response.body.model.performance_metrics.r2_score).toBe(0.93);
      expect(response.body.model.performance_metrics.mae).toBe(600);
      // Note: mse is not in the Model schema, only rmse
      expect(response.body.model.is_active).toBe(true);
    });
  });

  describe('POST /api/ml/train - Python Bridge Error Handling', () => {
    it('should handle Python execution errors', async () => {
      runPythonScript.mockRejectedValue(
        new PythonExecutionError('Training failed: Invalid data format', {
          exitCode: 1,
          stderr: 'ValueError: Invalid data format'
        })
      );

      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression',
          datasetId: testDataset._id.toString()
        })
        .expect(422);

      expect(response.body.error).toContain('Training failed');
      expect(response.body.type).toBe('python_execution_error');
    });

    it('should handle Python timeout errors', async () => {
      runPythonScript.mockRejectedValue(
        new PythonTimeoutError('Training execution timed out', {
          timeout: 120000
        })
      );

      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'neural_network',
          datasetId: testDataset._id.toString()
        })
        .expect(408);

      expect(response.body.error).toContain('timed out');
      expect(response.body.type).toBe('timeout_error');
    });

    it('should handle Python security errors', async () => {
      runPythonScript.mockRejectedValue(
        new PythonSecurityError('Security validation failed: Unauthorized file access', {
          violation: 'file_access'
        })
      );

      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression',
          datasetId: testDataset._id.toString()
        })
        .expect(403);

      expect(response.body.error).toContain('Security');
      expect(response.body.type).toBe('security_error');
    });

    it('should handle generic Python errors', async () => {
      runPythonScript.mockRejectedValue(new Error('Unknown Python error'));

      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression',
          datasetId: testDataset._id.toString()
        })
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/ml/train - Database Error Handling', () => {
    it('should handle database save errors', async () => {
      // Uses default mock from beforeEach

      // Mock Model constructor to throw an error
      const originalModel = Model;
      jest.spyOn(Model.prototype, 'save').mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'linear_regression',
          datasetId: testDataset._id.toString()
        })
        .expect(500);

      expect(response.body.error).toBeDefined();

      // Restore the original implementation
      Model.prototype.save.mockRestore();
    });
  });

  describe('GET /api/ml/train/status/:modelId - Training Status', () => {
    let trainedModel;

    beforeEach(async () => {
      // Create a trained model for status checks
      trainedModel = await Model.create({
        name: 'Status Test Model',
        type: 'regression',
        algorithm: 'linear_regression',
        training_data: {
          dataset_id: testDataset._id.toString(),
          sample_size: 1000,
          features: ['bedrooms', 'bathrooms', 'sqft'],
          target_variable: 'price',
          train_test_split: 0.2
        },
        performance_metrics: {
          r2_score: 0.88
        },
        is_active: true
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/ml/train/status/${trainedModel._id}`)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should return model status for valid modelId', async () => {
      const response = await request(app)
        .get(`/api/ml/train/status/${trainedModel._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.model).toBeDefined();
      expect(response.body.model._id).toBe(trainedModel._id.toString());
      expect(response.body.model.algorithm).toBe('linear_regression');
      expect(response.body.model.performance_metrics.r2_score).toBe(0.88);
    });

    it('should return 404 for non-existent modelId', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/ml/train/status/${nonExistentId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(404);

      expect(response.body.error).toContain('Model not found');
    });

    it('should return 400 for invalid modelId format', async () => {
      const response = await request(app)
        .get('/api/ml/train/status/invalid-id')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should populate dataset information', async () => {
      const response = await request(app)
        .get(`/api/ml/train/status/${trainedModel._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.model.training_data).toBeDefined();
      expect(response.body.model.training_data.dataset_id).toBeDefined();
    });
  });

  describe('Training Workflow Integration', () => {
    it('should complete full training workflow', async () => {
      // Step 1: Train the model
      runPythonScript.mockResolvedValue({
        model_id: new mongoose.Types.ObjectId().toString(),
        metrics: {
          r2_score: 0.91,
          mse: 950,
          mae: 700
        },
        training_time: 52.3,
        model_path: '/models/test_model.pkl',
        features: ['bedrooms', 'bathrooms', 'sqft'],
        target_variable: 'price',
        sample_size: 800,
        feature_importance: [
          { feature: 'sqft', importance: 0.55 },
          { feature: 'bedrooms', importance: 0.28 },
          { feature: 'bathrooms', importance: 0.17 }
        ]
      });

      const trainResponse = await request(app)
        .post('/api/ml/train')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          modelType: 'random_forest',
          datasetId: testDataset._id.toString(),
          hyperparameters: {
            n_estimators: 100,
            max_depth: 10
          }
        })
        .expect(200);

      expect(trainResponse.body.success).toBe(true);
      const modelId = trainResponse.body.model._id;

      // Step 2: Check the training status
      const statusResponse = await request(app)
        .get(`/api/ml/train/status/${modelId}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(statusResponse.body.model._id).toBe(modelId);
      expect(statusResponse.body.model.performance_metrics.r2_score).toBe(0.91);
      expect(statusResponse.body.model.is_active).toBe(true);

      // Step 3: Verify the model exists in database
      const savedModel = await Model.findById(modelId);
      expect(savedModel).toBeDefined();
      expect(savedModel.algorithm).toBe('random_forest');
      expect(savedModel.hyperparameters.n_estimators).toBe(100);
    });
  });
});
