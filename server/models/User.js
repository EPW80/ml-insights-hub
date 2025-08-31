const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'data_scientist'],
    default: 'user'
  },
  profile: {
    firstName: String,
    lastName: String,
    organization: String,
    phone: String
  },
  api_key: String,
  usage_stats: {
    predictions_made: { type: Number, default: 0 },
    models_trained: { type: Number, default: 0 },
    last_active: Date
  },
  preferences: {
    default_model: String,
    notification_settings: Object
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
