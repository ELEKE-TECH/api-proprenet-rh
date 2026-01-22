const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const logger = require('../utils/logger');

// Schéma pour l'historique des remboursements
const repaymentSchema = new Schema({
  amount: { type: Number, required: true, min: 0 },
  repaymentDate: { type: Date, required: true, default: Date.now },
  payrollId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Payroll',
    required: false // Peut être un remboursement manuel
  },
  paymentMethod: {
    type: String,
    enum: ['payroll_deduction', 'cash', 'bank_transfer', 'manual'],
    default: 'payroll_deduction'
  },
  notes: { type: String, trim: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { _id: true, timestamps: true });

const advanceSchema = new Schema({
  // Référence à l'agent
  agentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true
  },
  
  // Informations de base
  advanceNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  remaining: {
    type: Number,
    required: true,
    min: 0
  },
  totalRepaid: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Paramètres de remboursement
  monthlyRecovery: {
    type: Number,
    default: 0,
    min: 0
  },
  recoveryPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0 // Pourcentage du salaire net à déduire (si monthlyRecovery = 0)
  },
  maxRecoveryAmount: {
    type: Number,
    min: 0,
    default: 0 // Montant maximum à récupérer par mois (0 = pas de limite)
  },
  
  // Statut et workflow
  status: {
    type: String,
    enum: ['draft', 'requested', 'approved', 'rejected', 'paid', 'closed', 'cancelled'],
    default: 'draft',
    index: true
  },
  
  // Informations de paiement
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'mobile_money', 'check'],
    default: 'bank_transfer'
  },
  paymentReference: {
    type: String,
    trim: true
  },
  paidAt: {
    type: Date
  },
  paidBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Dates importantes
  requestedAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  approvedAt: { 
    type: Date 
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: { 
    type: Date 
  },
  rejectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedReason: {
    type: String,
    trim: true
  },
  closedAt: { 
    type: Date 
  },
  
  // Raison de la demande
  reason: {
    type: String,
    enum: ['urgent', 'medical', 'family', 'education', 'housing', 'other'],
    default: 'other'
  },
  reasonDetails: {
    type: String,
    trim: true
  },
  
  // Notes et commentaires
  notes: {
    type: String,
    trim: true
  },
  internalNotes: {
    type: String,
    trim: true // Notes internes non visibles par l'agent
  },
  
  // Documents joints (justificatifs, pièces, etc.)
  documents: [{
    name: { type: String, required: true, trim: true },
    originalName: { type: String, trim: true },
    path: { type: String, required: true },
    mimeType: { type: String, trim: true },
    size: { type: Number, min: 0 }, // Taille en bytes
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    description: { type: String, trim: true }
  }],
  
  // Historique des remboursements
  repayments: [repaymentSchema],
  
  // Statistiques
  numberOfRepayments: {
    type: Number,
    default: 0
  },
  lastRepaymentDate: {
    type: Date
  },
  
  // Métadonnées
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  updatedBy: {
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
advanceSchema.index({ agentId: 1, status: 1 });
advanceSchema.index({ status: 1, requestedAt: -1 });
advanceSchema.index({ agentId: 1, remaining: 1 });
advanceSchema.index({ createdAt: -1 });

// Générer automatiquement le numéro d'avance
advanceSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  // Générer le numéro d'avance uniquement si ce n'est pas déjà défini et si c'est un nouveau document
  if ((!this.advanceNumber || this.advanceNumber === '') && this.isNew) {
    try {
      const currentYear = new Date().getFullYear();
      const count = await this.constructor.countDocuments({
        advanceNumber: new RegExp(`^AV-${currentYear}-`)
      });
      
      const nextNumber = count + 1;
      // Format: AV-YYYY-0001
      this.advanceNumber = `AV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
    } catch (error) {
      logger.error('Erreur génération numéro d\'avance:', error);
      const currentYear = new Date().getFullYear();
      const fallbackNumber = String(Date.now()).slice(-4).padStart(4, '0');
      this.advanceNumber = `AV-${currentYear}-${fallbackNumber}`;
    }
  }
  
  // Calculer totalRepaid depuis les remboursements
  if (this.repayments && this.repayments.length > 0) {
    this.totalRepaid = this.repayments.reduce((sum, repayment) => sum + (repayment.amount || 0), 0);
    this.numberOfRepayments = this.repayments.length;
    
    // Trouver la date du dernier remboursement
    const lastRepayment = this.repayments
      .filter(r => r.repaymentDate)
      .sort((a, b) => b.repaymentDate - a.repaymentDate)[0];
    if (lastRepayment) {
      this.lastRepaymentDate = lastRepayment.repaymentDate;
    }
  }
  
  // Mettre à jour remaining
  this.remaining = Math.max(0, this.amount - (this.totalRepaid || 0));
  
  // Mettre à jour le statut automatiquement
  if (this.remaining === 0 && this.status === 'approved') {
    this.status = 'closed';
    if (!this.closedAt) {
      this.closedAt = new Date();
    }
  }
  
  next();
});

// Méthodes virtuelles
advanceSchema.virtual('progressPercentage').get(function() {
  if (this.amount === 0) return 0;
  return Math.round((this.totalRepaid / this.amount) * 100);
});

advanceSchema.virtual('estimatedMonthsRemaining').get(function() {
  if (!this.monthlyRecovery || this.monthlyRecovery === 0) return null;
  return Math.ceil(this.remaining / this.monthlyRecovery);
});

// Méthodes d'instance
advanceSchema.methods.addRepayment = function(repaymentData) {
  this.repayments.push(repaymentData);
  this.totalRepaid = (this.totalRepaid || 0) + repaymentData.amount;
  this.remaining = Math.max(0, this.amount - this.totalRepaid);
  this.numberOfRepayments = this.repayments.length;
  
  if (this.remaining === 0 && this.status === 'approved') {
    this.status = 'closed';
    this.closedAt = new Date();
  }
  
  return this;
};

advanceSchema.methods.canBeRecoveredFromPayroll = function(payrollNetAmount) {
  if (this.status !== 'approved' || this.remaining <= 0) {
    return { canRecover: false, reason: 'Avance non approuvée ou déjà remboursée' };
  }
  
  if (!payrollNetAmount || payrollNetAmount <= 0) {
    return { canRecover: false, reason: 'Salaire net insuffisant' };
  }
  
  // Calculer le montant à récupérer
  let recoveryAmount = 0;
  
  if (this.monthlyRecovery > 0) {
    // Montant fixe mensuel
    recoveryAmount = Math.min(this.monthlyRecovery, this.remaining);
  } else if (this.recoveryPercentage > 0) {
    // Pourcentage du salaire net
    recoveryAmount = Math.min(
      (payrollNetAmount * this.recoveryPercentage) / 100,
      this.remaining
    );
  }
  
  // Vérifier la limite maximale
  if (this.maxRecoveryAmount > 0) {
    recoveryAmount = Math.min(recoveryAmount, this.maxRecoveryAmount);
  }
  
  // Vérifier que le montant ne dépasse pas le salaire net disponible
  if (recoveryAmount > payrollNetAmount) {
    return { 
      canRecover: false, 
      reason: `Le montant de récupération (${recoveryAmount}) dépasse le salaire net (${payrollNetAmount})` 
    };
  }
  
  return { 
    canRecover: true, 
    amount: recoveryAmount 
  };
};

module.exports = mongoose.model('Advance', advanceSchema);
