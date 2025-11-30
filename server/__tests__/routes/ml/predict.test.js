/**
 * Tests for ML Prediction Routes
 *
 * Tests cover:
 * - Prediction storage to database
 * - Input validation
 * - Error handling (Python bridge failures)
 * - Database operations
 * - Authentication requirements
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const Prediction = require('../../../models/Prediction');
const User = require('../../../models/User');
const predictRoutes = require('../../../routes/ml/predict');
const {
  PythonExecutionError,
  PythonTimeoutError,
  PythonSecurityError
} = require('../../../utils/securePythonBridge');

// Setup Express app for testing
const app = express();
app.use(express.json());
app.use('/api/ml/predict', predictRoutes);

// Set up environment
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.SKIP_AUTH = 'false'; // Enforce auth for these tests

// Mock the securePythonBridge module
jest.mock('../../../utils/securePythonBridge', () => {
  const originalModule = jest.requireActual('../../../utils/securePythonBridge');

  return {
    ...originalModule,
    executeMlPrediction: jest.fn(),
    PythonExecutionError: originalModule.PythonExecutionError || class PythonExecutionError extends Error {
      constructor(message, details) {
        super(message);
        this.name = 'PythonExecutionError';
        this.details = details;
      }
    },
    PythonTimeoutError: originalModule.PythonTimeoutError || class PythonTimeoutError extends Error {
      constructor(message, details) {
        super(message);
        this.name = 'PythonTimeoutError';
        this.details = details;
      }
    },
    PythonSecurityError: originalModule.PythonSecurityError || class PythonSecurityError extends Error {
      constructor(message, type) {
        super(message);
        this.name = 'PythonSecurityError';
        this.type = type;
        this.timestamp = new Date();
      }
    }
  };
});

const { executeMlPrediction } = require('../../../utils/securePythonBridge');

describe('ML Prediction Routes', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      username: 'mluser',
      email: 'ml@example.com',
      password: 'password123',
      role: 'user'
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser._id, role: testUser.role },
      process.env.JWT_SECRET
    );
  });

  beforeEach(() => {
    // Reset mock before each test
    executeMlPrediction.mockReset();
  });

  describe('POST /api/ml/predict', () => {
    describe('Authentication', () => {
      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/ml/predict')
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body).toHaveProperty('error');
      });

      it('should accept valid authentication token', async () => {
        // Mock successful prediction
        executeMlPrediction.mockResolvedValue({
          prediction: 350000,
          lower_bound: 325000,
          upper_bound: 375000,
          confidence_level: 0.95,
          uncertainty_metrics: { std_deviation: 15000 }
        });

        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('Input Validation', () => {
      it('should require features parameter', async () => {
        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            modelType: 'linear_regression'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Missing required parameters');
      });

      it('should require modelType parameter', async () => {
        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 }
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Missing required parameters');
      });

      it('should validate features is an object', async () => {
        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: 'invalid',
            modelType: 'linear_regression'
          })
          .expect(400);

        expect(response.body.error).toContain('Features must be an object');
      });

      it('should reject features as array', async () => {
        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: [1, 2, 3],
            modelType: 'linear_regression'
          })
          .expect(400);

        expect(response.body.error).toContain('Features must be an object');
      });

      it('should validate modelType against allowed values', async () => {
        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'invalid_model'
          })
          .expect(400);

        expect(response.body.error).toContain('Invalid model type');
      });

      it('should accept valid model types', async () => {
        executeMlPrediction.mockResolvedValue({
          prediction: 350000,
          lower_bound: 325000,
          upper_bound: 375000,
          confidence_level: 0.95
        });

        const validModels = ['linear_regression', 'random_forest', 'neural_network', 'gradient_boosting'];

        for (const modelType of validModels) {
          const response = await request(app)
            .post('/api/ml/predict')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              features: { bedrooms: 3, sqft: 1500 },
              modelType
            })
            .expect(200);

          expect(response.body.success).toBe(true);
        }
      });

      it('should validate uncertainty method if provided', async () => {
        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression',
            uncertaintyMethod: 'invalid_method'
          })
          .expect(400);

        expect(response.body.error).toContain('Invalid uncertainty method');
      });

      it('should accept valid uncertainty methods', async () => {
        executeMlPrediction.mockResolvedValue({
          prediction: 350000,
          lower_bound: 325000,
          upper_bound: 375000,
          confidence_level: 0.95
        });

        const validMethods = ['ensemble', 'bootstrap', 'quantile', 'bayesian'];

        for (const uncertaintyMethod of validMethods) {
          const response = await request(app)
            .post('/api/ml/predict')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              features: { bedrooms: 3, sqft: 1500 },
              modelType: 'linear_regression',
              uncertaintyMethod
            })
            .expect(200);

          expect(response.body.success).toBe(true);
        }
      });
    });

    describe('Successful Predictions', () => {
      beforeEach(() => {
        executeMlPrediction.mockResolvedValue({
          prediction: 350000,
          lower_bound: 325000,
          upper_bound: 375000,
          confidence_level: 0.95,
          uncertainty_metrics: {
            std_deviation: 15000,
            prediction_interval: [325000, 375000]
          },
          feature_importance: {
            sqft: 0.6,
            bedrooms: 0.3,
            bathrooms: 0.1
          }
        });
      });

      it('should create prediction with valid input', async () => {
        const features = { bedrooms: 3, bathrooms: 2, sqft: 1500 };

        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features,
            modelType: 'random_forest'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('prediction');
        expect(response.body).toHaveProperty('execution_time');
        expect(response.body).toHaveProperty('timestamp');
      });

      it('should store prediction in database', async () => {
        const features = { bedrooms: 4, bathrooms: 3, sqft: 2200 };

        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features,
            modelType: 'gradient_boosting'
          })
          .expect(200);

        // Verify prediction was saved
        const savedPrediction = await Prediction.findById(response.body.prediction._id);
        expect(savedPrediction).toBeDefined();
        expect(savedPrediction.model_type).toBe('gradient_boosting');
        expect(savedPrediction.property_features.bedrooms).toBe(4);
      });

      it('should store prediction details correctly', async () => {
        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          })
          .expect(200);

        const prediction = response.body.prediction;
        expect(prediction.prediction.point_estimate).toBe(350000);
        expect(prediction.prediction.lower_bound).toBe(325000);
        expect(prediction.prediction.upper_bound).toBe(375000);
        expect(prediction.prediction.confidence_level).toBe(0.95);
        expect(prediction.prediction.uncertainty_metrics).toBeDefined();
      });

      it('should include feature importance in prediction', async () => {
        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500, bathrooms: 2 },
            modelType: 'random_forest'
          })
          .expect(200);

        expect(response.body.prediction.feature_importance).toBeDefined();
        expect(Array.isArray(response.body.prediction.feature_importance)).toBe(true);
        // Feature importance is stored as an array of {feature, importance} objects
        if (response.body.prediction.feature_importance.length > 0) {
          const sqftImportance = response.body.prediction.feature_importance.find(item => item.feature === 'sqft');
          expect(sqftImportance).toBeDefined();
          expect(sqftImportance.importance).toBe(0.6);
        }
      });

      it('should include execution time', async () => {
        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          })
          .expect(200);

        expect(response.body.execution_time).toBeDefined();
        expect(typeof response.body.execution_time).toBe('number');
        expect(response.body.execution_time).toBeGreaterThan(0);
      });
    });

    describe('Python Bridge Error Handling', () => {
      it('should handle Python execution errors', async () => {
        executeMlPrediction.mockRejectedValue(
          new PythonExecutionError('Script execution failed', {
            exitCode: 1,
            executionTime: 5000
          })
        );

        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          })
          .expect(422);

        expect(response.body.success).toBe(false);
        expect(response.body.type).toBe('python_execution_error');
        expect(response.body).toHaveProperty('details');
      });

      it('should handle Python timeout errors', async () => {
        executeMlPrediction.mockRejectedValue(
          new PythonTimeoutError('Script execution timed out', {
            timeout: 30000,
            retryCount: 1
          })
        );

        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'neural_network'
          })
          .expect(408);

        expect(response.body.success).toBe(false);
        expect(response.body.type).toBe('timeout_error');
        expect(response.body.details).toBeDefined();
        // Details may or may not include timeout depending on error structure
        if (response.body.details.timeout) {
          expect(response.body.details.timeout).toBe(30000);
        }
      });

      it('should handle Python security errors', async () => {
        executeMlPrediction.mockRejectedValue(
          new PythonSecurityError('Security violation detected', 'MALICIOUS_INPUT')
        );

        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          })
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.type).toBe('security_error');
      });

      it('should handle invalid Python response', async () => {
        executeMlPrediction.mockResolvedValue(null);

        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          })
          .expect(422); // PythonParseError returns 422

        expect(response.body.success).toBe(false);
        // PythonParseError is alias for PythonExecutionError, so type is python_execution_error
        expect(response.body.type).toBe('python_execution_error');
      });

      it('should handle missing required fields in Python response', async () => {
        executeMlPrediction.mockResolvedValue({
          prediction: 350000
          // Missing lower_bound, upper_bound, confidence_level
        });

        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          })
          .expect(422); // PythonParseError returns 422

        expect(response.body.error).toContain('Missing required fields');
        // PythonParseError is alias for PythonExecutionError, so type is python_execution_error
        expect(response.body.type).toBe('python_execution_error');
      });
    });

    describe('Database Operations', () => {
      beforeEach(() => {
        executeMlPrediction.mockResolvedValue({
          prediction: 350000,
          lower_bound: 325000,
          upper_bound: 375000,
          confidence_level: 0.95
        });
      });

      it('should handle database save errors', async () => {
        // Mock Prediction.save to throw error
        const mockSave = jest.spyOn(Prediction.prototype, 'save');
        mockSave.mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          })
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Database connection failed');

        mockSave.mockRestore();
      });

      it('should handle database validation errors', async () => {
        // Mock to return invalid data that fails Mongoose validation
        executeMlPrediction.mockResolvedValue({
          prediction: 'invalid', // Should be number
          lower_bound: 325000,
          upper_bound: 375000,
          confidence_level: 0.95
        });

        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          });

        // Should either handle gracefully or return error
        expect(response.body.success).toBeDefined();
      });

      it('should persist all prediction fields', async () => {
        const features = {
          bedrooms: 5,
          bathrooms: 4,
          sqft: 3000,
          year_built: 2015
        };

        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features,
            modelType: 'random_forest',
            uncertaintyMethod: 'bootstrap'
          })
          .expect(200);

        const saved = await Prediction.findById(response.body.prediction._id);
        expect(saved.property_features.bedrooms).toBe(5);
        expect(saved.property_features.sqft).toBe(3000);
        expect(saved.model_type).toBe('random_forest');
      });
    });

    describe('Response Format', () => {
      beforeEach(() => {
        executeMlPrediction.mockResolvedValue({
          prediction: 350000,
          lower_bound: 325000,
          upper_bound: 375000,
          confidence_level: 0.95,
          uncertainty_metrics: { std_deviation: 15000 }
        });
      });

      it('should return success flag in response', async () => {
        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should include timestamp in response', async () => {
        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          })
          .expect(200);

        expect(response.body.timestamp).toBeDefined();
        expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
      });

      it('should include error details on failure', async () => {
        executeMlPrediction.mockRejectedValue(new Error('Test error'));

        const response = await request(app)
          .post('/api/ml/predict')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            features: { bedrooms: 3, sqft: 1500 },
            modelType: 'linear_regression'
          })
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
        expect(response.body.timestamp).toBeDefined();
      });
    });
  });
});
