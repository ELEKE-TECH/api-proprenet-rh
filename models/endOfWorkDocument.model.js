const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const endOfWorkDocumentSchema = new Schema({
  documentNumber: {
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
    required: true,
    index: true
  },
  // Type de fin de contrat
  terminationType: {
    type: String,
    enum: ['resignation', 'dismissal', 'end_of_contract', 'mutual_agreement', 'retirement', 'death', 'other'],
    required: true
  },
  // Dates
  terminationDate: {
    type: Date,
    required: true
  },
  lastWorkingDay: {
    type: Date,
    required: true
  },
  noticePeriodStart: {
    type: Date
  },
  noticePeriodEnd: {
    type: Date
  },
  // Motif détaillé
  reason: {
    type: String,
    required: true,
    trim: true
  },
  // Période d'ancienneté
  seniorityPeriod: {
    startDate: { type: Date },
    endDate: { type: Date }
  },
  // Nombre de mois de travail
  monthsWorked: { type: Number, default: 0, min: 0 },
  // Règlement financier selon le format du décompte
  financialSettlement: {
    // Salaire mensuel
    monthlySalary: { type: Number, default: 0, min: 0 },
    // Salaire global des X mois
    totalSalaryForMonths: { type: Number, default: 0, min: 0 },
    // Indemnité du service rendu (en pourcentage)
    serviceRenderedPercentage: { type: Number, default: 0, min: 0, max: 100 },
    serviceRenderedAmount: { type: Number, default: 0, min: 0 },
    // Indemnité de congé sur un an
    annualLeaveIndemnity: { type: Number, default: 0, min: 0 },
    // Indemnité de fin de contrat
    endOfContractIndemnity: { type: Number, default: 0, min: 0 },
    // Indemnité droits sociaux
    socialRightsIndemnity: { type: Number, default: 0, min: 0 },
    // Total à payer
    totalAmount: { type: Number, default: 0, min: 0 },
    // Total payé
    paidAmount: { type: Number, default: 0, min: 0 },
    // Reste à payer
    remainingAmount: { type: Number, default: 0, min: 0 }
  },
  // Paiement
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'completed'],
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'mobile_money', 'check', 'other']
  },
  paymentDate: {
    type: Date
  },
  paymentReference: {
    type: String,
    trim: true
  },
  // Matériel/équipement retournés
  returnedItems: [{
    item: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1 },
    returnedAt: { type: Date, default: Date.now },
    condition: { type: String, enum: ['good', 'fair', 'poor', 'damaged'] },
    notes: String
  }],
  // Documents remis
  documentsReturned: [{
    documentType: { type: String, required: true, trim: true },
    returnedAt: { type: Date, default: Date.now },
    notes: String
  }],
  // Notes administratives
  adminNotes: {
    type: String,
    trim: true
  },
  // Signature agent
  agentAcknowledged: {
    type: Boolean,
    default: false
  },
  agentAcknowledgedAt: {
    type: Date
  },
  // Document PDF
  documentPath: {
    type: String
  },
  // Validation
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
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
endOfWorkDocumentSchema.index({ agentId: 1, terminationDate: -1 });
endOfWorkDocumentSchema.index({ workContractId: 1 });
endOfWorkDocumentSchema.index({ paymentStatus: 1 });

endOfWorkDocumentSchema.pre('save', function(next) {
  // Calculer le reste à payer
  if (this.financialSettlement) {
    this.financialSettlement.remainingAmount = 
      (this.financialSettlement.totalAmount || 0) - (this.financialSettlement.paidAmount || 0);
  }
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('EndOfWorkDocument', endOfWorkDocumentSchema);

