const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  address: {
    type: String,
    required: true
  },
  coordinates: {
    lat: Number,
    lng: Number
  },
  features: {
    bedrooms: Number,
    bathrooms: Number,
    sqft: Number,
    lot_size: Number,
    year_built: Number,
    garage: Number,
    property_type: String,
    condition: String
  },
  neighborhood_data: {
    crime_rate: Number,
    school_rating: Number,
    walkability_score: Number,
    public_transport_access: Number,
    shopping_proximity: Number
  },
  actual_price: Number,
  listed_price: Number,
  date_listed: Date,
  date_sold: Date,
  data_source: String,
  images: [String],
  description: String
}, {
  timestamps: true
});

// Geospatial index for location-based queries
propertySchema.index({ coordinates: '2dsphere' });

// Compound indexes for common filter combinations
propertySchema.index({ 'features.bedrooms': 1, 'features.bathrooms': 1 });
propertySchema.index({ 'features.sqft': 1, actual_price: 1 });
propertySchema.index({ 'features.property_type': 1, actual_price: 1 });

// Price range queries
propertySchema.index({ actual_price: 1 });
propertySchema.index({ listed_price: 1 });

// Date-based queries for recent listings
propertySchema.index({ date_listed: -1 });
propertySchema.index({ date_sold: -1 });
propertySchema.index({ createdAt: -1 });

// Neighborhood data for filtering
propertySchema.index({ 'neighborhood_data.school_rating': 1 });
propertySchema.index({ 'neighborhood_data.walkability_score': 1 });

// Compound index for multi-filter searches (bedrooms + bathrooms + price range)
propertySchema.index({
  'features.bedrooms': 1,
  'features.bathrooms': 1,
  actual_price: 1
});

// Text search index for address
propertySchema.index({ address: 'text', description: 'text' });

module.exports = mongoose.model('Property', propertySchema);
