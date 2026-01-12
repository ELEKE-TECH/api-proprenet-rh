const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const recruitmentSchema = new Schema({
  firstName: { 
    type: String, 
    required: true,
    trim: true
  },
  lastName: { 
    type: String, 
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  birthDate: { 
    type: Date 
  },
  gender: {
    type: String,
    enum: ['M', 'F', 'Autre'],
    trim: true
  },
  maritalStatus: {
    type: String,
    enum: ['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf(ve)', 'Concubinage'],
    trim: true
  },
  identityDocument: {
    type: { type: String, enum: ['CNI', 'Passeport', 'Carte consulaire', 'Permis de conduire', 'Autre'] },
    number: { type: String, trim: true },
    issuedDate: { type: Date },
    issuedAt: { type: String, trim: true }
  },
  address: { 
    type: String,
    trim: true
  },
  languages: [{ 
    type: String,
    trim: true
  }],
  skills: [{ 
    type: String,
    trim: true
  }],
  experience: {
    years: { type: Number, default: 0, min: 0 },
    description: { type: String, trim: true }
  },
  expectedHourlyRate: { 
    type: Number, 
    default: 0,
    min: 0
  },
  status: { 
    type: String, 
    enum: ['pending', 'reviewed', 'accepted', 'rejected', 'converted'],
    default: 'pending',
    index: true
  },
  recruiterNotes: { 
    type: String,
    trim: true
  },
  rejectionReason: {
    type: String,
    trim: true
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  convertedToAgent: {
    type: Schema.Types.ObjectId,
    ref: 'Agent'
  },
  convertedAt: {
    type: Date
  },
  documents: [{
    type: Schema.Types.ObjectId,
    ref: 'Document'
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Index pour les recherches
recruitmentSchema.index({ status: 1, createdAt: -1 });
recruitmentSchema.index({ email: 1 });
recruitmentSchema.index({ phone: 1 });

// Mettre à jour updatedAt avant la sauvegarde
recruitmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Recruitment', recruitmentSchema);

