/**
 * Tests for Property model
 *
 * Validates:
 * - Schema constraints and required fields
 * - Nested objects (coordinates, features, neighborhood_data)
 * - Array fields (images)
 * - Geospatial indexes (2dsphere)
 * - Text indexes
 * - Compound indexes
 * - Timestamps
 */

const mongoose = require('mongoose');
const Property = require('../../models/Property');

describe('Property Model', () => {
  describe('Schema Validation', () => {
    it('should create a property with valid data', async () => {
      const propertyData = {
        address: '123 Main St, City, State 12345',
        features: {
          bedrooms: 3,
          bathrooms: 2,
          sqft: 1800
        }
      };

      const property = await Property.create(propertyData);

      expect(property._id).toBeDefined();
      expect(property.address).toBe(propertyData.address);
      expect(property.features.bedrooms).toBe(3);
      expect(property.features.bathrooms).toBe(2);
    });

    it('should require address field', async () => {
      const property = new Property({
        features: {
          bedrooms: 3,
          bathrooms: 2
        }
      });

      await expect(property.save()).rejects.toThrow();
    });

    it('should allow minimal property with just address', async () => {
      const property = await Property.create({
        address: '456 Oak Ave'
      });

      expect(property.address).toBe('456 Oak Ave');
      // Mongoose initializes nested objects as empty objects
      expect(property.features).toBeDefined();
    });
  });

  describe('Coordinates', () => {
    it('should store latitude and longitude', async () => {
      const property = await Property.create({
        address: '789 Elm St',
        coordinates: {
          lat: 40.7128,
          lng: -74.0060
        }
      });

      expect(property.coordinates.lat).toBe(40.7128);
      expect(property.coordinates.lng).toBe(-74.0060);
    });

    it('should allow undefined coordinates', async () => {
      const property = await Property.create({
        address: '123 Test St'
      });

      // Mongoose initializes nested objects as empty objects
      expect(property.coordinates).toBeDefined();
    });

    it('should handle coordinates for geospatial queries', async () => {
      // Note: For 2dsphere geospatial indexes, coordinates should be [lng, lat] order
      // This test validates coordinate storage
      const property = await Property.create({
        address: 'Test Address',
        coordinates: {
          lat: 40.7128,
          lng: -74.0060
        }
      });

      expect(property.coordinates.lat).toBe(40.7128);
      expect(property.coordinates.lng).toBe(-74.0060);
    });
  });

  describe('Features Object', () => {
    it('should store all property features', async () => {
      const property = await Property.create({
        address: 'Feature Test Property',
        features: {
          bedrooms: 4,
          bathrooms: 3,
          sqft: 2500,
          lot_size: 0.25,
          year_built: 2010,
          garage: 2,
          property_type: 'single-family',
          condition: 'excellent'
        }
      });

      expect(property.features.bedrooms).toBe(4);
      expect(property.features.bathrooms).toBe(3);
      expect(property.features.sqft).toBe(2500);
      expect(property.features.lot_size).toBe(0.25);
      expect(property.features.year_built).toBe(2010);
      expect(property.features.garage).toBe(2);
      expect(property.features.property_type).toBe('single-family');
      expect(property.features.condition).toBe('excellent');
    });

    it('should allow partial features', async () => {
      const property = await Property.create({
        address: 'Partial Features Property',
        features: {
          bedrooms: 3,
          sqft: 1500
        }
      });

      expect(property.features.bedrooms).toBe(3);
      expect(property.features.sqft).toBe(1500);
      expect(property.features.bathrooms).toBeUndefined();
    });

    it('should handle decimal values for features', async () => {
      const property = await Property.create({
        address: 'Decimal Test',
        features: {
          bathrooms: 2.5,
          lot_size: 0.33
        }
      });

      expect(property.features.bathrooms).toBe(2.5);
      expect(property.features.lot_size).toBe(0.33);
    });
  });

  describe('Neighborhood Data', () => {
    it('should store neighborhood metrics', async () => {
      const property = await Property.create({
        address: 'Neighborhood Test Property',
        neighborhood_data: {
          crime_rate: 2.5,
          school_rating: 8.5,
          walkability_score: 75,
          public_transport_access: 85,
          shopping_proximity: 90
        }
      });

      expect(property.neighborhood_data.crime_rate).toBe(2.5);
      expect(property.neighborhood_data.school_rating).toBe(8.5);
      expect(property.neighborhood_data.walkability_score).toBe(75);
      expect(property.neighborhood_data.public_transport_access).toBe(85);
      expect(property.neighborhood_data.shopping_proximity).toBe(90);
    });

    it('should allow undefined neighborhood data', async () => {
      const property = await Property.create({
        address: 'No Neighborhood Data'
      });

      // Mongoose initializes nested objects as empty objects
      expect(property.neighborhood_data).toBeDefined();
    });
  });

  describe('Pricing Information', () => {
    it('should store actual and listed prices', async () => {
      const property = await Property.create({
        address: 'Pricing Test Property',
        actual_price: 450000,
        listed_price: 475000
      });

      expect(property.actual_price).toBe(450000);
      expect(property.listed_price).toBe(475000);
    });

    it('should allow undefined prices', async () => {
      const property = await Property.create({
        address: 'No Price Property'
      });

      expect(property.actual_price).toBeUndefined();
      expect(property.listed_price).toBeUndefined();
    });
  });

  describe('Dates', () => {
    it('should store listing and sale dates', async () => {
      const listedDate = new Date('2024-01-15');
      const soldDate = new Date('2024-02-20');

      const property = await Property.create({
        address: 'Date Test Property',
        date_listed: listedDate,
        date_sold: soldDate
      });

      expect(property.date_listed).toEqual(listedDate);
      expect(property.date_sold).toEqual(soldDate);
    });

    it('should allow undefined dates', async () => {
      const property = await Property.create({
        address: 'No Dates Property'
      });

      expect(property.date_listed).toBeUndefined();
      expect(property.date_sold).toBeUndefined();
    });
  });

  describe('Data Source', () => {
    it('should store data source', async () => {
      const property = await Property.create({
        address: 'Source Test Property',
        data_source: 'Zillow API'
      });

      expect(property.data_source).toBe('Zillow API');
    });
  });

  describe('Images Array', () => {
    it('should store multiple image URLs', async () => {
      const property = await Property.create({
        address: 'Images Test Property',
        images: [
          'https://example.com/img1.jpg',
          'https://example.com/img2.jpg',
          'https://example.com/img3.jpg'
        ]
      });

      expect(property.images).toHaveLength(3);
      expect(property.images[0]).toBe('https://example.com/img1.jpg');
      expect(property.images[2]).toBe('https://example.com/img3.jpg');
    });

    it('should allow empty images array', async () => {
      const property = await Property.create({
        address: 'No Images Property',
        images: []
      });

      expect(property.images).toHaveLength(0);
    });

    it('should allow undefined images', async () => {
      const property = await Property.create({
        address: 'Undefined Images Property'
      });

      // Mongoose initializes arrays as empty arrays
      expect(property.images).toEqual([]);
    });
  });

  describe('Description', () => {
    it('should store property description', async () => {
      const description = 'Beautiful 3-bedroom home in quiet neighborhood';
      const property = await Property.create({
        address: 'Description Test Property',
        description: description
      });

      expect(property.description).toBe(description);
    });

    it('should store long descriptions', async () => {
      const longDescription = 'Lorem ipsum dolor sit amet, '.repeat(50);
      const property = await Property.create({
        address: 'Long Description Property',
        description: longDescription
      });

      expect(property.description).toBe(longDescription);
    });
  });

  describe('Indexes', () => {
    it('should have geospatial index on coordinates', async () => {
      const indexes = Property.schema.indexes();
      const geoIndex = indexes.find(idx => idx[0].coordinates === '2dsphere');

      expect(geoIndex).toBeDefined();
    });

    it('should have text index on address and description', async () => {
      const indexes = Property.schema.indexes();
      const textIndex = indexes.find(idx => idx[0].address === 'text');

      expect(textIndex).toBeDefined();
    });

    it('should have index on actual_price', async () => {
      const indexes = Property.schema.indexes();
      const priceIndex = indexes.find(idx => idx[0].actual_price === 1);

      expect(priceIndex).toBeDefined();
    });

    it('should have index on listed_price', async () => {
      const indexes = Property.schema.indexes();
      const listedIndex = indexes.find(idx => idx[0].listed_price === 1);

      expect(listedIndex).toBeDefined();
    });

    it('should have compound index on bedrooms and bathrooms', async () => {
      const indexes = Property.schema.indexes();
      const compoundIndex = indexes.find(
        idx => idx[0]['features.bedrooms'] === 1 && idx[0]['features.bathrooms'] === 1
      );

      expect(compoundIndex).toBeDefined();
    });

    it('should have index on date_listed', async () => {
      const indexes = Property.schema.indexes();
      const dateIndex = indexes.find(idx => idx[0].date_listed === -1);

      expect(dateIndex).toBeDefined();
    });

    it('should have index on createdAt', async () => {
      const indexes = Property.schema.indexes();
      const createdIndex = indexes.find(idx => idx[0].createdAt === -1);

      expect(createdIndex).toBeDefined();
    });
  });

  describe('Timestamps', () => {
    it('should automatically add createdAt timestamp', async () => {
      const property = await Property.create({
        address: 'Timestamp Test Property'
      });

      expect(property.createdAt).toBeDefined();
      expect(property.createdAt).toBeInstanceOf(Date);
    });

    it('should automatically add updatedAt timestamp', async () => {
      const property = await Property.create({
        address: 'Update Test Property'
      });

      expect(property.updatedAt).toBeDefined();
      expect(property.updatedAt).toBeInstanceOf(Date);
    });

    it('should update updatedAt on modification', async () => {
      const property = await Property.create({
        address: 'Modify Test Property'
      });

      const originalUpdatedAt = property.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      property.actual_price = 500000;
      await property.save();

      expect(property.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Complete Property', () => {
    it('should create property with all fields populated', async () => {
      const property = await Property.create({
        address: '789 Complete Ave, City, ST 54321',
        coordinates: {
          lat: 40.7128,
          lng: -74.0060
        },
        features: {
          bedrooms: 5,
          bathrooms: 4,
          sqft: 3200,
          lot_size: 0.5,
          year_built: 2018,
          garage: 3,
          property_type: 'luxury-home',
          condition: 'pristine'
        },
        neighborhood_data: {
          crime_rate: 1.2,
          school_rating: 9.5,
          walkability_score: 88,
          public_transport_access: 92,
          shopping_proximity: 95
        },
        actual_price: 1250000,
        listed_price: 1350000,
        date_listed: new Date('2024-01-01'),
        date_sold: new Date('2024-02-15'),
        data_source: 'Multiple Listing Service',
        images: [
          'https://example.com/front.jpg',
          'https://example.com/kitchen.jpg',
          'https://example.com/backyard.jpg'
        ],
        description: 'Stunning 5-bedroom luxury home in prime location with modern amenities'
      });

      expect(property.address).toBe('789 Complete Ave, City, ST 54321');
      expect(property.coordinates.lat).toBe(40.7128);
      expect(property.features.bedrooms).toBe(5);
      expect(property.features.sqft).toBe(3200);
      expect(property.neighborhood_data.school_rating).toBe(9.5);
      expect(property.actual_price).toBe(1250000);
      expect(property.images).toHaveLength(3);
      expect(property.description).toContain('luxury');
    });
  });

  describe('Query Scenarios', () => {
    beforeEach(async () => {
      await Property.create([
        {
          address: '100 Test St',
          features: { bedrooms: 3, bathrooms: 2, sqft: 1500 },
          actual_price: 300000
        },
        {
          address: '200 Test St',
          features: { bedrooms: 4, bathrooms: 3, sqft: 2200 },
          actual_price: 450000
        },
        {
          address: '300 Test St',
          features: { bedrooms: 2, bathrooms: 1, sqft: 1000 },
          actual_price: 200000
        }
      ]);
    });

    it('should query by bedrooms', async () => {
      const properties = await Property.find({ 'features.bedrooms': 3 });

      expect(properties).toHaveLength(1);
      expect(properties[0].address).toBe('100 Test St');
    });

    it('should query by price range', async () => {
      const properties = await Property.find({
        actual_price: { $gte: 250000, $lte: 350000 }
      });

      expect(properties).toHaveLength(1);
      expect(properties[0].actual_price).toBe(300000);
    });

    it('should query by multiple features', async () => {
      const properties = await Property.find({
        'features.bedrooms': { $gte: 3 },
        'features.bathrooms': { $gte: 2 },
        actual_price: { $lte: 500000 }
      });

      expect(properties).toHaveLength(2);
    });

    it('should sort by price', async () => {
      const properties = await Property.find({}).sort({ actual_price: 1 });

      expect(properties[0].actual_price).toBe(200000);
      expect(properties[2].actual_price).toBe(450000);
    });
  });
});
