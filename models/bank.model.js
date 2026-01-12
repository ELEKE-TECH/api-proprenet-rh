const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const bankSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  code: {
    type: String,
    trim: true,
    unique: true,
    sparse: true
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true,
    default: "N'Djamena"
  },
  country: {
    type: String,
    trim: true,
    default: 'Tchad'
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  // Informations de compte entreprise
  companyAccountNumber: {
    type: String,
    trim: true
  },
  // Nom du directeur général ou contact principal
  directorName: {
    type: String,
    trim: true
  },
  // Référence de l'ordre de virement (format: D12/PNET/DG/25)
  transferReferencePrefix: {
    type: String,
    trim: true,
    default: 'D12/PNET/DG'
  },
  isActive: {
    type: Boolean,
    default: true
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

// Mettre à jour updatedAt avant la sauvegarde
bankSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Bank', bankSchema);

