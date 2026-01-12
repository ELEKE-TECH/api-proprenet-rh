const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const workContractSchema = new Schema({
  contractNumber: {
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
  contractType: {
    type: String,
    enum: ['cdi', 'cdd', 'stage', 'interim', 'temporaire'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: function() {
      return this.contractType === 'cdd' || this.contractType === 'stage' || this.contractType === 'interim' || this.contractType === 'temporaire';
    }
  },
  position: {
    type: String,
    required: true,
    trim: true
  },
  siteId: {
    type: Schema.Types.ObjectId,
    ref: 'Site',
    index: true
  },
  // Rémunération
  salary: {
    baseSalary: { type: Number, required: true, min: 0 },
    hourlyRate: { type: Number, min: 0 },
    currency: { type: String, default: 'FCFA' },
    paymentFrequency: {
      type: String,
      enum: ['mensuel', 'hebdomadaire', 'bihebdomadaire', 'quotidien'],
      default: 'mensuel'
    }
  },
  // Horaires de travail
  workingHours: {
    hoursPerWeek: { type: Number, default: 40 },
    schedule: {
      monday: { start: String, end: String },
      tuesday: { start: String, end: String },
      wednesday: { start: String, end: String },
      thursday: { start: String, end: String },
      friday: { start: String, end: String },
      saturday: { start: String, end: String },
      sunday: { start: String, end: String }
    }
  },
  // Clause de période d'essai
  trialPeriod: {
    startDate: Date,
    endDate: Date,
    duration: { type: Number, default: 0 } // en jours
  },
  // Statut du contrat
  status: {
    type: String,
    enum: ['draft', 'pending_signature', 'active', 'suspended', 'terminated', 'expired', 'cancelled'],
    default: 'draft',
    index: true
  },
  // Signatures
  signatures: {
    employer: {
      signed: { type: Boolean, default: false },
      signedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      signedAt: Date,
      signatureImage: String // Chemin vers l'image de signature
    },
    employee: {
      signed: { type: Boolean, default: false },
      signedAt: Date,
      signatureImage: String
    }
  },
  // Motif de fin de contrat (si terminé)
  terminationReason: {
    type: String,
    enum: ['resignation', 'dismissal', 'end_of_contract', 'mutual_agreement', 'retirement', 'death', 'other']
  },
  terminationDate: Date,
  // Droits financiers
  financialRights: {
    accruedSalary: { type: Number, default: 0 },
    paidLeave: { type: Number, default: 0 }, // Jours de congé non pris
    severancePay: { type: Number, default: 0 },
    noticePay: { type: Number, default: 0 },
    bonuses: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  // Notes et conditions particulières
  notes: {
    type: String,
    trim: true
  },
  terms: {
    type: String,
    trim: true
  },
  // Documents associés
  documents: [{
    type: { type: String, enum: ['contract_pdf', 'signed_contract', 'amendment', 'other'] },
    filePath: String,
    fileName: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
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

// Index pour les recherches
workContractSchema.index({ agentId: 1, status: 1 });
workContractSchema.index({ status: 1, startDate: -1 });
workContractSchema.index({ contractNumber: 1 });

// Mettre à jour updatedAt
workContractSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('WorkContract', workContractSchema);

