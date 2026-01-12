const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const materialSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true,
    index: true
  },
  unit: {
    type: String,
    required: true,
    enum: ['unité', 'kg', 'l', 'm', 'm²', 'm³', 'lot', 'paquet', 'carton', 'palette'],
    default: 'unité'
  },
  unitPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  supplier: {
    name: String,
    contact: {
      phone: String,
      email: String,
      address: String
    }
  },
  minimumStock: {
    type: Number,
    default: 0,
    min: 0
  },
  maximumStock: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour recherches
materialSchema.index({ name: 1 });
materialSchema.index({ category: 1, isActive: 1 });

// Générer automatiquement le code si non fourni
materialSchema.pre('save', async function(next) {
  if (!this.code) {
    const count = await mongoose.model('Material').countDocuments();
    const year = new Date().getFullYear();
    this.code = `MAT-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Material', materialSchema);

