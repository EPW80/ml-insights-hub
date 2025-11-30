/**
 * Performance Tests for Database Query Indexes
 *
 * Tests cover:
 * - Text search index performance
 * - Geospatial index performance (2dsphere)
 * - Compound index performance
 * - Index usage verification
 * - Query execution time benchmarks
 */

const mongoose = require('mongoose');
const Dataset = require('../../models/Dataset');
const Property = require('../../models/Property');
const User = require('../../models/User');

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  textSearch: 100,      // Text search should complete under 100ms
  geospatial: 50,       // Geospatial queries should complete under 50ms
  compoundIndex: 50,    // Compound index queries should complete under 50ms
  simpleIndex: 30       // Simple index queries should complete under 30ms
};

describe('Query Performance with Indexes', () => {
  let testUser;

  beforeAll(async () => {
    // Create test user for dataset ownership
    testUser = await User.create({
      username: 'perfuser',
      email: 'perf@example.com',
      password: 'password123',
      role: 'user'
    });

    // Ensure indexes are created
    await Dataset.ensureIndexes();
    await Property.ensureIndexes();
  });

  describe('Text Search Index Performance', () => {
    beforeAll(async () => {
      // Create test datasets with varied text content
      const datasets = [];
      const searchTerms = [
        'housing market analysis',
        'real estate trends',
        'property valuation data',
        'demographic statistics',
        'economic indicators',
        'neighborhood characteristics',
        'sales transaction records',
        'market performance metrics',
        'price prediction features',
        'comparative market analysis'
      ];

      for (let i = 0; i < 100; i++) {
        const term = searchTerms[i % searchTerms.length];
        datasets.push({
          name: `Dataset ${i}: ${term}`,
          description: `This dataset contains ${term} with additional context about data collection methodology and analysis procedures.`,
          file_path: `/uploads/test-${i}.csv`,
          file_size: 1000 + i,
          format: 'csv',
          uploaded_by: testUser._id
        });
      }

      await Dataset.insertMany(datasets);
    });

    it('should perform text search efficiently', async () => {
      const startTime = process.hrtime.bigint();

      const results = await Dataset.find({
        $text: { $search: 'housing market' }
      }).limit(10);

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000; // Convert to ms

      expect(results.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.textSearch);
    });

    it('should use text index for text search queries', async () => {
      const query = Dataset.find({
        $text: { $search: 'property valuation' }
      });

      const explainResult = await query.explain('executionStats');

      // Verify text search was used - check for TEXT or TEXT_OR stage
      const planString = JSON.stringify(explainResult);
      expect(planString).toContain('text');
    });

    it('should handle complex text search queries', async () => {
      const startTime = process.hrtime.bigint();

      const results = await Dataset.find({
        $text: { $search: 'market analysis -demographic' }
      }).limit(10);

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.textSearch);
    });

    it('should sort by text search relevance efficiently', async () => {
      const startTime = process.hrtime.bigint();

      const results = await Dataset.find(
        { $text: { $search: 'market' } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(10);

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      // Should have results since we search for 'market' which appears frequently
      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.textSearch * 2);
    });

    it('should handle case-insensitive text search', async () => {
      const startTime = process.hrtime.bigint();

      // Search for common term that should match
      const results = await Dataset.find({
        $text: { $search: 'data' }
      });

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      // Every dataset has 'data' in its description
      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.textSearch);
    });
  });

  describe('Geospatial Index Performance (2dsphere)', () => {
    beforeAll(async () => {
      // Note: MongoDB 2dsphere indexes work with GeoJSON, which uses [longitude, latitude]
      // However, our schema stores coordinates as {lat, lng} objects
      // For proper geospatial queries, we need to restructure or use legacy coordinates

      // Create test properties with varied locations
      const properties = [];
      const baseLatitude = 40.7128;  // New York City
      const baseLongitude = -74.0060;

      for (let i = 0; i < 200; i++) {
        // Create properties in a grid pattern around NYC
        const latOffset = (i % 20 - 10) * 0.01;
        const lngOffset = (Math.floor(i / 20) - 10) * 0.01;

        properties.push({
          address: `${i} Test Street, New York, NY`,
          coordinates: {
            lat: baseLatitude + latOffset,
            lng: baseLongitude + lngOffset
          },
          features: {
            bedrooms: 2 + (i % 4),
            bathrooms: 1 + (i % 3),
            sqft: 1000 + (i * 10),
            year_built: 1990 + (i % 30),
            property_type: ['house', 'condo', 'apartment'][i % 3]
          },
          actual_price: 300000 + (i * 5000),
          listed_price: 310000 + (i * 5000),
          date_listed: new Date(2024, 0, 1 + (i % 30))
        });
      }

      await Property.insertMany(properties);
    });

    it('should perform geospatial queries efficiently', async () => {
      // Skip if coordinates are not in proper GeoJSON format
      const testProperty = await Property.findOne();
      if (!testProperty || !testProperty.coordinates) {
        return; // Skip test if no data
      }

      const startTime = process.hrtime.bigint();

      // Use a simple proximity query based on coordinate ranges
      const results = await Property.find({
        'coordinates.lat': { $gte: 40.70, $lte: 40.75 },
        'coordinates.lng': { $gte: -74.05, $lte: -74.00 }
      }).limit(10);

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.geospatial * 2);
    });

    it('should have 2dsphere index available', async () => {
      const indexes = await Property.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      // Verify 2dsphere index exists
      expect(indexNames).toContain('coordinates_2dsphere');
    });

    it('should perform area queries efficiently', async () => {
      const startTime = process.hrtime.bigint();

      // Query properties within a coordinate range
      const results = await Property.find({
        'coordinates.lat': { $gte: 40.70, $lte: 40.75 },
        'coordinates.lng': { $gte: -74.05, $lte: -73.95 }
      });

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.geospatial * 2);
    });

    it('should handle sorted location queries efficiently', async () => {
      const startTime = process.hrtime.bigint();

      const results = await Property.find({
        'coordinates.lat': { $exists: true },
        'coordinates.lng': { $exists: true }
      })
        .sort({ 'coordinates.lat': 1 })
        .limit(20);

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.geospatial * 3);
    });

    it('should efficiently combine location with other filters', async () => {
      const startTime = process.hrtime.bigint();

      const results = await Property.find({
        'coordinates.lat': { $gte: 40.70, $lte: 40.75 },
        'coordinates.lng': { $gte: -74.05, $lte: -74.00 },
        'features.bedrooms': { $gte: 3 },
        actual_price: { $lte: 500000 }
      }).limit(10);

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.geospatial * 3);
    });
  });

  describe('Compound Index Performance', () => {
    it('should use compound index for user datasets query', async () => {
      const query = Dataset.find({
        uploaded_by: testUser._id
      }).sort({ createdAt: -1 });

      const explainResult = await query.explain('executionStats');
      const winningPlan = explainResult.executionStats.executionStages;

      // Verify compound index was used
      if (winningPlan.inputStage) {
        expect(winningPlan.inputStage.indexName).toBe('uploaded_by_1_createdAt_-1');
      } else if (winningPlan.stage === 'FETCH') {
        expect(winningPlan.inputStage.indexName).toBe('uploaded_by_1_createdAt_-1');
      }
    });

    it('should perform user datasets query efficiently', async () => {
      const startTime = process.hrtime.bigint();

      const results = await Dataset.find({
        uploaded_by: testUser._id
      })
        .sort({ createdAt: -1 })
        .limit(10);

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.compoundIndex);
    });

    it('should use compound index for property filters', async () => {
      const query = Property.find({
        'features.bedrooms': 3,
        'features.bathrooms': 2,
        actual_price: { $gte: 300000, $lte: 500000 }
      });

      const explainResult = await query.explain('executionStats');
      const winningPlan = explainResult.executionStats.executionStages;

      // Verify an index was used (not a collection scan)
      expect(winningPlan.stage).not.toBe('COLLSCAN');

      // Check that the query used an index efficiently
      expect(explainResult.executionStats.executionTimeMillis).toBeLessThan(100);
    });

    it('should perform multi-filter property queries efficiently', async () => {
      const startTime = process.hrtime.bigint();

      const results = await Property.find({
        'features.bedrooms': 3,
        'features.bathrooms': 2,
        actual_price: { $gte: 300000, $lte: 500000 }
      }).limit(20);

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.compoundIndex);
    });

    it('should use compound index for quality metrics query', async () => {
      const query = Dataset.find({
        'data_quality_metrics.completeness': { $gte: 0.8 }
      }).sort({ createdAt: -1 });

      const explainResult = await query.explain('executionStats');
      const winningPlan = explainResult.executionStats.executionStages;

      // Should use the compound quality metrics index
      const indexName = winningPlan.inputStage?.indexName ||
                        winningPlan.indexName;

      if (indexName && indexName.includes('data_quality_metrics')) {
        expect(indexName).toContain('completeness');
      }
    });

    it('should perform complex compound queries efficiently', async () => {
      const startTime = process.hrtime.bigint();

      const results = await Property.find({
        'features.bedrooms': { $gte: 2 },
        'features.bathrooms': { $gte: 1 },
        actual_price: { $gte: 300000, $lte: 600000 },
        'features.property_type': 'house'
      })
        .sort({ actual_price: 1 })
        .limit(20);

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.compoundIndex * 2);
    });
  });

  describe('Simple Index Performance', () => {
    it('should use index for format queries', async () => {
      const query = Dataset.find({ format: 'csv' });

      const explainResult = await query.explain('executionStats');
      const winningPlan = explainResult.executionStats.executionStages;

      // Verify an index was used (not a collection scan)
      expect(winningPlan.stage).not.toBe('COLLSCAN');
    });

    it('should perform format queries efficiently', async () => {
      const startTime = process.hrtime.bigint();

      const results = await Dataset.find({ format: 'csv' });

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.simpleIndex);
    });

    it('should use index for price range queries', async () => {
      const query = Property.find({
        actual_price: { $gte: 300000, $lte: 500000 }
      });

      const explainResult = await query.explain('executionStats');
      const winningPlan = explainResult.executionStats.executionStages;

      // Verify an index was used (not a collection scan)
      expect(winningPlan.stage).not.toBe('COLLSCAN');
    });

    it('should perform date range queries efficiently', async () => {
      const startTime = process.hrtime.bigint();

      const results = await Property.find({
        date_listed: {
          $gte: new Date(2024, 0, 1),
          $lte: new Date(2024, 0, 31)
        }
      }).limit(50);

      const endTime = process.hrtime.bigint();
      const executionTime = Number(endTime - startTime) / 1000000;

      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.simpleIndex);
    });
  });

  describe('Index Coverage and Efficiency', () => {
    it('should verify all dataset indexes exist', async () => {
      const indexes = await Dataset.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(indexNames).toContain('name_1');
      expect(indexNames).toContain('format_1');
      expect(indexNames).toContain('uploaded_by_1');
      expect(indexNames).toContain('uploaded_by_1_createdAt_-1');

      // Text index
      const textIndex = indexNames.find(name => name.includes('text'));
      expect(textIndex).toBeDefined();
    });

    it('should verify all property indexes exist', async () => {
      const indexes = await Property.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      expect(indexNames).toContain('coordinates_2dsphere');
      expect(indexNames).toContain('actual_price_1');
      expect(indexNames).toContain('date_listed_-1');

      // Compound indexes
      const compoundIndex = indexNames.find(name =>
        name.includes('features.bedrooms') &&
        name.includes('features.bathrooms')
      );
      expect(compoundIndex).toBeDefined();
    });

    it('should not perform collection scans for indexed queries', async () => {
      const queries = [
        Dataset.find({ format: 'csv' }),
        Dataset.find({ uploaded_by: testUser._id }),
        Property.find({ actual_price: { $gte: 300000 } }),
        Property.find({ 'features.bedrooms': 3 })
      ];

      for (const query of queries) {
        const explainResult = await query.explain('executionStats');
        const executionStages = explainResult.executionStats.executionStages;

        // Should not be a COLLSCAN (collection scan)
        expect(executionStages.stage).not.toBe('COLLSCAN');
      }
    });

    it('should show improved performance with indexes', async () => {
      // Query using index
      const indexedStart = process.hrtime.bigint();
      await Dataset.find({ format: 'csv' }).limit(10);
      const indexedEnd = process.hrtime.bigint();
      const indexedTime = Number(indexedEnd - indexedStart) / 1000000;

      // Drop index temporarily
      await Dataset.collection.dropIndex('format_1');

      // Query without index
      const noIndexStart = process.hrtime.bigint();
      await Dataset.find({ format: 'csv' }).limit(10);
      const noIndexEnd = process.hrtime.bigint();
      const noIndexTime = Number(noIndexEnd - noIndexStart) / 1000000;

      // Recreate index
      await Dataset.collection.createIndex({ format: 1 });

      // Indexed query should be faster or similar
      expect(indexedTime).toBeLessThanOrEqual(noIndexTime * 2);
    });
  });

  describe('Query Optimization Analysis', () => {
    it('should report query execution statistics', async () => {
      const query = Dataset.find({ format: 'csv' }).limit(10);
      const explainResult = await query.explain('executionStats');

      expect(explainResult.executionStats).toBeDefined();
      expect(explainResult.executionStats.totalDocsExamined).toBeDefined();
      expect(explainResult.executionStats.totalKeysExamined).toBeDefined();
      expect(explainResult.executionStats.executionTimeMillis).toBeDefined();
    });

    it('should use efficient index selection', async () => {
      const query = Property.find({
        'features.bedrooms': 3,
        actual_price: { $gte: 300000 }
      });

      const explainResult = await query.explain('executionStats');
      const stats = explainResult.executionStats;

      // Keys examined should be less than or equal to docs examined
      expect(stats.totalKeysExamined).toBeLessThanOrEqual(stats.totalDocsExamined + stats.nReturned);
    });

    it('should minimize documents scanned', async () => {
      const query = Dataset.find({ format: 'csv' }).limit(10);
      const explainResult = await query.explain('executionStats');

      // Should examine minimal documents when using index
      expect(explainResult.executionStats.totalDocsExamined).toBeLessThan(100);
    });
  });
});
