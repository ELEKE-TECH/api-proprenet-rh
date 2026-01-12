const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const workCertificateSchema = new Schema({
  certificateNumber: {
    type: String,
    unique: true,
    trim: true,
    sparse: true,
    index: true
  },
  agentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true
  },
  workContractId: {
    type: Schema.Types.ObjectId,
    ref: 'WorkContract',
    index: true
  },
  issueDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  // Période de travail certifiée
  periodStart: {
    type: Date,
    required: true
  },
  periodEnd: {
    type: Date,
    required: true
  },
  // Poste occupé
  position: {
    type: String,
    required: true,
    trim: true
  },
  // Raison de la délivrance
  reason: {
    type: String,
    enum: ['end_of_contract', 'resignation', 'dismissal', 'retirement', 'request', 'other'],
    required: true
  },
  reasonDetails: {
    type: String,
    trim: true
  },
  // Informations sur les performances
  performance: {
    type: String,
    enum: ['excellent', 'good', 'satisfactory', 'needs_improvement', 'not_specified'],
    default: 'satisfactory'
  },
  performanceNotes: {
    type: String,
    trim: true
  },
  // Disponibilité pour réembauche
  rehirable: {
    type: Boolean,
    default: true
  },
  // Signature et validation
  signedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  signedAt: {
    type: Date
  },
  // Document PDF généré
  documentPath: {
    type: String
  },
  // Remarques supplémentaires
  additionalNotes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
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

// Index
workCertificateSchema.index({ agentId: 1, issueDate: -1 });
workCertificateSchema.index({ certificateNumber: 1 });

workCertificateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('WorkCertificate', workCertificateSchema);

