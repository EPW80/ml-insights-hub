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

propertySchema.index({ coordinates: '2dsphere' });
propertySchema.index({ 'features.bedrooms': 1, 'features.bathrooms': 1 });

module.exports = mongoose.model('Property', propertySchema);
