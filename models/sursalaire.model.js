const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sursalaireSchema = new Schema({
  // Référence à l'agent bénéficiaire (celui qui reçoit le sursalaire)
  beneficiaryAgentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true
  },
  
  // Période concernée
  periodStart: {
    type: Date,
    required: true,
    index: true
  },
  periodEnd: {
    type: Date,
    required: true,
    index: true
  },
  month: {
    type: Number,
    min: 1,
    max: 12,
    index: true
  },
  year: {
    type: Number,
    index: true
  },
  
  // Montant total des retenues d'accomptes pour cette période
  totalAdvanceDeductions: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  
  // Détails des accomptes déduits (références aux avances)
  advanceDeductions: [{
    advanceId: {
      type: Schema.Types.ObjectId,
      ref: 'Advance',
      required: true
    },
    payrollId: {
      type: Schema.Types.ObjectId,
      ref: 'Payroll',
      required: true
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true
    },
    deductionAmount: {
      type: Number,
      required: true,
      min: 0
    },
    deductionDate: {
      type: Date,
      required: true
    }
  }],
  
  // Montant crédité au bénéficiaire
  creditedAmount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Statut du sursalaire
  status: {
    type: String,
    enum: ['pending', 'credited', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Date de crédit
  creditedAt: {
    type: Date
  },
  
  // Référence au salaire créé pour le bénéficiaire (si applicable)
  beneficiaryPayrollId: {
    type: Schema.Types.ObjectId,
    ref: 'Payroll'
  },
  
  // Notes et commentaires
  notes: {
    type: String,
    trim: true
  },
  
  // Métadonnées
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  creditedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  cancelledAt: {
    type: Date
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
sursalaireSchema.index({ beneficiaryAgentId: 1, periodStart: -1, periodEnd: -1 });
sursalaireSchema.index({ status: 1, periodEnd: -1 });
sursalaireSchema.index({ createdAt: -1 });

// Hook pre-save pour mettre à jour updatedAt
sursalaireSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Sursalaire', sursalaireSchema);

