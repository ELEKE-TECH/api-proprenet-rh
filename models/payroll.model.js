const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const payrollSchema = new Schema({
  agentId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Agent', 
    required: true,
    index: true
  },
  month: { type: Number, min: 1, max: 12, index: true },
  year: { type: Number, index: true },
  periodStart: { 
    type: Date, 
    required: true
  },
  periodEnd: { 
    type: Date, 
    required: true
  },
  paymentType: {
    type: String,
    enum: ['hourly', 'daily', 'fixed', 'commission'],
    required: true
  },
  baseAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Gains détaillés selon le format exact du bulletin
  gains: {
    baseSalary: { type: Number, default: 0, min: 0 }, // Salaire de base
    seniority: { type: Number, default: 0, min: 0 }, // Ancienneté
    sursalaire: { type: Number, default: 0, min: 0 }, // Sursalaire
    primes: { type: Number, default: 0, min: 0 }, // Primes (total)
    responsibility: { type: Number, default: 0, min: 0 }, // Responsabilité
    risk: { type: Number, default: 0, min: 0 }, // Risque
    transport: { type: Number, default: 0, min: 0 }, // Transport
    otherBonuses: { type: Number, default: 0, min: 0 }, // Autres primes
    totalIndemnities: { type: Number, default: 0, min: 0 }, // Total indemnités
    housingBonus: { type: Number, default: 0, min: 0 }, // Prime de logement
    overtimeHours: { type: Number, default: 0, min: 0 }, // Heure supplémentaire
    absence: { type: Number, default: 0, min: 0 }, // Absence (déduction)
    grossSalary: { type: Number, default: 0, min: 0 } // Salaire brut (calculé)
  },
  // Charges salariales (retenues)
  deductions: {
    cnpsEmployee: { type: Number, default: 0, min: 0 }, // CNPS (part salariale)
    irpp: { type: Number, default: 0, min: 0 }, // IRPP
    fir: { type: Number, default: 0, min: 0 }, // FIR
    advance: { type: Number, default: 0, min: 0 }, // Accompte
    reimbursement: { type: Number, default: 0, min: 0 }, // Remboursement divers
    totalRetenues: { type: Number, default: 0, min: 0 } // Total retenues (calculé)
  },
  // Charges patronales
  employerCharges: {
    cnpsEmployer: { type: Number, default: 0, min: 0 } // CNPS (part patronale)
  },
  // Totaux cumulés
  cumulative: {
    totalCost: { type: Number, default: 0, min: 0 }, // Coût total
    grossSalary: { type: Number, default: 0, min: 0 }, // Salaire brut
    employeeCharges: { type: Number, default: 0, min: 0 }, // Charges salariales
    employerCharges: { type: Number, default: 0, min: 0 }, // Charges patronales
    taxes: { type: Number, default: 0, min: 0 }, // Impôts (IRPP + FIR)
    overtimeHours: { type: Number, default: 0, min: 0 }, // Heures sup.
    netPayable: { type: Number, default: 0, min: 0 } // Salaire net à payer
  },
  // Avances appliquées (référence aux avances)
  advancesApplied: [{
    advanceId: { type: Schema.Types.ObjectId, ref: 'Advance' },
    amount: { type: Number, required: true }
  }],
  // Référence au contrat utilisé pour ce bulletin
  workContractId: {
    type: Schema.Types.ObjectId,
    ref: 'WorkContract',
    index: true
  },
  netAmount: { 
    type: Number, 
    required: true,
    min: 0
  },
  paid: { 
    type: Boolean, 
    default: false 
  },
  paidAt: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'mobile_money', 'check'],
    default: 'bank_transfer'
  },
  paymentReference: {
    type: String
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

// Index pour les recherches par agent et période
payrollSchema.index({ agentId: 1, periodStart: -1, periodEnd: -1 });
payrollSchema.index({ paid: 1, periodEnd: -1 });

// Calculer automatiquement les totaux avant la sauvegarde
payrollSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // S'assurer que gains et deductions sont des objets
  if (!this.gains) {
    this.gains = {};
  }
  if (!this.deductions) {
    this.deductions = {};
  }
  if (!this.employerCharges) {
    this.employerCharges = {};
  }
  
  // Calculer le salaire brut (somme des gains - absence)
  this.gains.grossSalary = 
    (this.gains.baseSalary || 0) +
    (this.gains.seniority || 0) +
    (this.gains.sursalaire || 0) +
    (this.gains.primes || 0) +
    (this.gains.responsibility || 0) +
    (this.gains.risk || 0) +
    (this.gains.transport || 0) +
    (this.gains.otherBonuses || 0) +
    (this.gains.totalIndemnities || 0) +
    (this.gains.housingBonus || 0) +
    (this.gains.overtimeHours || 0) -
    (this.gains.absence || 0);
  
  // Calculer le total des retenues
  this.deductions.totalRetenues = 
    (this.deductions.cnpsEmployee || 0) +
    (this.deductions.irpp || 0) +
    (this.deductions.fir || 0) +
    (this.deductions.advance || 0) +
    (this.deductions.reimbursement || 0);
  
  // Calculer le salaire net à payer (OBLIGATOIRE)
  const grossSalary = this.gains.grossSalary || 0;
  const totalDeductions = this.deductions.totalRetenues || 0;
  this.netAmount = Math.max(0, grossSalary - totalDeductions);
  
  // S'assurer que cumulative existe
  if (!this.cumulative) {
    this.cumulative = {};
  }
  
  // Calculer les totaux cumulés (pour ce bulletin)
  this.cumulative.grossSalary = grossSalary;
  this.cumulative.employeeCharges = this.deductions.totalRetenues || 0;
  this.cumulative.employerCharges = this.employerCharges.cnpsEmployer || 0;
  this.cumulative.taxes = (this.deductions.irpp || 0) + (this.deductions.fir || 0);
  this.cumulative.overtimeHours = this.gains.overtimeHours || 0;
  this.cumulative.netPayable = this.netAmount;
  this.cumulative.totalCost = grossSalary + (this.employerCharges.cnpsEmployer || 0);
  
  next();
});

module.exports = mongoose.model('Payroll', payrollSchema);

