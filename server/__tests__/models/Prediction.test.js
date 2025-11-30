/**
 * Tests for Prediction model
 *
 * Validates:
 * - Schema constraints and required fields
 * - References (property_id, model_id, user_id)
 * - Nested objects (prediction, uncertainty_metrics)
 * - Array fields (feature_importance)
 * - Indexes
 * - Timestamps
 */

const mongoose = require('mongoose');
const Prediction = require('../../models/Prediction');
const Model = require('../../models/Model');
const Property = require('../../models/Property');
const User = require('../../models/User');

describe('Prediction Model', () => {
  let testUser, testModel, testProperty;

  beforeEach(async () => {
    testUser = await User.create({
      username: 'predictor',
      email: 'predictor@example.com',
      password: 'password123'
    });

    testModel = await Model.create({
      name: 'Test Prediction Model',
      type: 'regression',
      algorithm: 'linear_regression'
    });

    testProperty = await Property.create({
      address: '123 Test St',
      features: {
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1500
      }
    });
  });

  describe('Schema Validation', () => {
    it('should create a prediction with valid data', async () => {
      const predictionData = {
        property_id: testProperty._id,
        model_id: testModel._id,
        user_id: testUser._id,
        property_features: {
          bedrooms: 3,
          bathrooms: 2,
          sqft: 1500
        },
        prediction: {
          point_estimate: 350000
        }
      };

      const prediction = await Prediction.create(predictionData);

      expect(prediction._id).toBeDefined();
      expect(prediction.property_id.toString()).toBe(testProperty._id.toString());
      expect(prediction.model_id.toString()).toBe(testModel._id.toString());
      expect(prediction.user_id.toString()).toBe(testUser._id.toString());
      expect(prediction.property_features.bedrooms).toBe(3);
    });

    it('should require property_features field', async () => {
      const prediction = new Prediction({
        property_id: testProperty._id,
        model_id: testModel._id
      });

      await expect(prediction.save()).rejects.toThrow();
    });

    it('should allow optional property_id', async () => {
      const prediction = await Prediction.create({
        model_id: testModel._id,
        property_features: { bedrooms: 3 }
      });

      expect(prediction.property_id).toBeUndefined();
    });

    it('should allow optional model_id', async () => {
      const prediction = await Prediction.create({
        property_id: testProperty._id,
        property_features: { bedrooms: 3 }
      });

      expect(prediction.model_id).toBeUndefined();
    });

    it('should allow optional user_id', async () => {
      const prediction = await Prediction.create({
        property_features: { bedrooms: 3 }
      });

      expect(prediction.user_id).toBeUndefined();
    });
  });

  describe('Property Features', () => {
    it('should store property features as object', async () => {
      const prediction = await Prediction.create({
        property_features: {
          bedrooms: 4,
          bathrooms: 3,
          sqft: 2200,
          year_built: 2010,
          garage: 2
        }
      });

      expect(prediction.property_features.bedrooms).toBe(4);
      expect(prediction.property_features.bathrooms).toBe(3);
      expect(prediction.property_features.sqft).toBe(2200);
      expect(prediction.property_features.year_built).toBe(2010);
    });

    it('should allow any structure in property_features', async () => {
      const prediction = await Prediction.create({
        property_features: {
          custom_field: 'value',
          nested: {
            field: 123
          }
        }
      });

      expect(prediction.property_features.custom_field).toBe('value');
      expect(prediction.property_features.nested.field).toBe(123);
    });
  });

  describe('Prediction Object', () => {
    it('should store point estimate', async () => {
      const prediction = await Prediction.create({
        property_features: { bedrooms: 3 },
        prediction: {
          point_estimate: 400000
        }
      });

      expect(prediction.prediction.point_estimate).toBe(400000);
    });

    it('should store prediction bounds', async () => {
      const prediction = await Prediction.create({
        property_features: { bedrooms: 3 },
        prediction: {
          point_estimate: 400000,
          lower_bound: 350000,
          upper_bound: 450000,
          confidence_level: 0.95
        }
      });

      expect(prediction.prediction.lower_bound).toBe(350000);
      expect(prediction.prediction.upper_bound).toBe(450000);
      expect(prediction.prediction.confidence_level).toBe(0.95);
    });

    it('should store uncertainty metrics', async () => {
      const prediction = await Prediction.create({
        property_features: { bedrooms: 3 },
        prediction: {
          point_estimate: 400000,
          uncertainty_metrics: {
            std_deviation: 25000,
            prediction_interval: [350000, 450000],
            quantiles: {
              q25: 380000,
              q50: 400000,
              q75: 420000
            },
            coefficient_of_variation: 0.0625
          }
        }
      });

      expect(prediction.prediction.uncertainty_metrics.std_deviation).toBe(25000);
      expect(prediction.prediction.uncertainty_metrics.prediction_interval).toHaveLength(2);
      expect(prediction.prediction.uncertainty_metrics.quantiles.q50).toBe(400000);
      expect(prediction.prediction.uncertainty_metrics.coefficient_of_variation).toBe(0.0625);
    });
  });

  describe('Feature Importance', () => {
    it('should track feature importance', async () => {
      const prediction = await Prediction.create({
        property_features: { bedrooms: 3 },
        feature_importance: [
          { feature: 'sqft', importance: 0.45 },
          { feature: 'bedrooms', importance: 0.25 },
          { feature: 'bathrooms', importance: 0.20 },
          { feature: 'year_built', importance: 0.10 }
        ]
      });

      expect(prediction.feature_importance).toHaveLength(4);
      expect(prediction.feature_importance[0].feature).toBe('sqft');
      expect(prediction.feature_importance[0].importance).toBe(0.45);
      expect(prediction.feature_importance[3].importance).toBe(0.10);
    });

    it('should allow empty feature importance array', async () => {
      const prediction = await Prediction.create({
        property_features: { bedrooms: 3 },
        feature_importance: []
      });

      expect(prediction.feature_importance).toHaveLength(0);
    });
  });

  describe('Model Confidence and Explanation', () => {
    it('should store model confidence', async () => {
      const prediction = await Prediction.create({
        property_features: { bedrooms: 3 },
        model_confidence: 0.92
      });

      expect(prediction.model_confidence).toBe(0.92);
    });

    it('should store explanation text', async () => {
      const prediction = await Prediction.create({
        property_features: { bedrooms: 3 },
        explanation: 'Prediction based on square footage and location data'
      });

      expect(prediction.explanation).toBe('Prediction based on square footage and location data');
    });

    it('should store model type', async () => {
      const prediction = await Prediction.create({
        property_features: { bedrooms: 3 },
        model_type: 'gradient_boosting'
      });

      expect(prediction.model_type).toBe('gradient_boosting');
    });
  });

  describe('References', () => {
    it('should reference Property model', async () => {
      const prediction = await Prediction.create({
        property_id: testProperty._id,
        property_features: { bedrooms: 3 }
      });

      const populatedPrediction = await Prediction.findById(prediction._id)
        .populate('property_id');

      expect(populatedPrediction.property_id._id.toString()).toBe(testProperty._id.toString());
      expect(populatedPrediction.property_id.address).toBe('123 Test St');
    });

    it('should reference Model model', async () => {
      const prediction = await Prediction.create({
        model_id: testModel._id,
        property_features: { bedrooms: 3 }
      });

      const populatedPrediction = await Prediction.findById(prediction._id)
        .populate('model_id');

      expect(populatedPrediction.model_id._id.toString()).toBe(testModel._id.toString());
      expect(populatedPrediction.model_id.name).toBe('Test Prediction Model');
    });

    it('should reference User model', async () => {
      const prediction = await Prediction.create({
        user_id: testUser._id,
        property_features: { bedrooms: 3 }
      });

      const populatedPrediction = await Prediction.findById(prediction._id)
        .populate('user_id');

      expect(populatedPrediction.user_id._id.toString()).toBe(testUser._id.toString());
      expect(populatedPrediction.user_id.username).toBe('predictor');
    });

    it('should populate all references at once', async () => {
      const prediction = await Prediction.create({
        property_id: testProperty._id,
        model_id: testModel._id,
        user_id: testUser._id,
        property_features: { bedrooms: 3 }
      });

      const populatedPrediction = await Prediction.findById(prediction._id)
        .populate('property_id')
        .populate('model_id')
        .populate('user_id');

      expect(populatedPrediction.property_id.address).toBe('123 Test St');
      expect(populatedPrediction.model_id.name).toBe('Test Prediction Model');
      expect(populatedPrediction.user_id.username).toBe('predictor');
    });
  });

  describe('Indexes', () => {
    it('should have index on property_id', async () => {
      const indexes = Prediction.schema.indexes();
      const propertyIndex = indexes.find(idx => idx[0].property_id === 1);

      expect(propertyIndex).toBeDefined();
    });

    it('should have index on model_id', async () => {
      const indexes = Prediction.schema.indexes();
      const modelIndex = indexes.find(idx => idx[0].model_id === 1);

      expect(modelIndex).toBeDefined();
    });

    it('should have index on user_id', async () => {
      const indexes = Prediction.schema.indexes();
      const userIndex = indexes.find(idx => idx[0].user_id === 1);

      expect(userIndex).toBeDefined();
    });

    it('should have index on model_type', async () => {
      const indexes = Prediction.schema.indexes();
      const typeIndex = indexes.find(idx => idx[0].model_type === 1);

      expect(typeIndex).toBeDefined();
    });

    it('should have index on createdAt', async () => {
      const indexes = Prediction.schema.indexes();
      const createdAtIndex = indexes.find(idx => idx[0].createdAt === -1);

      expect(createdAtIndex).toBeDefined();
    });
  });

  describe('Timestamps', () => {
    it('should automatically add createdAt timestamp', async () => {
      const prediction = await Prediction.create({
        property_features: { bedrooms: 3 }
      });

      expect(prediction.createdAt).toBeDefined();
      expect(prediction.createdAt).toBeInstanceOf(Date);
    });

    it('should automatically add updatedAt timestamp', async () => {
      const prediction = await Prediction.create({
        property_features: { bedrooms: 3 }
      });

      expect(prediction.updatedAt).toBeDefined();
      expect(prediction.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt on modification', async () => {
      const prediction = await Prediction.create({
        property_features: { bedrooms: 3 }
      });

      const originalUpdatedAt = prediction.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      prediction.model_confidence = 0.95;
      await prediction.save();

      expect(prediction.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Complete Prediction', () => {
    it('should create prediction with all fields populated', async () => {
      const prediction = await Prediction.create({
        property_id: testProperty._id,
        model_id: testModel._id,
        user_id: testUser._id,
        property_features: {
          bedrooms: 4,
          bathrooms: 3,
          sqft: 2500,
          year_built: 2015,
          garage: 2
        },
        model_type: 'gradient_boosting',
        prediction: {
          point_estimate: 450000,
          lower_bound: 400000,
          upper_bound: 500000,
          confidence_level: 0.95,
          uncertainty_metrics: {
            std_deviation: 30000,
            prediction_interval: [400000, 500000],
            quantiles: {
              q25: 430000,
              q50: 450000,
              q75: 470000
            },
            coefficient_of_variation: 0.067
          }
        },
        feature_importance: [
          { feature: 'sqft', importance: 0.50 },
          { feature: 'year_built', importance: 0.20 },
          { feature: 'bedrooms', importance: 0.15 },
          { feature: 'bathrooms', importance: 0.10 },
          { feature: 'garage', importance: 0.05 }
        ],
        model_confidence: 0.93,
        explanation: 'High confidence prediction based on comprehensive feature analysis'
      });

      expect(prediction.property_features.bedrooms).toBe(4);
      expect(prediction.prediction.point_estimate).toBe(450000);
      expect(prediction.feature_importance).toHaveLength(5);
      expect(prediction.model_confidence).toBe(0.93);
    });
  });
});
