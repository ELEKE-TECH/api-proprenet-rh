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
  // Gains simplifiés - uniquement les champs essentiels
  gains: {
    baseSalary: { type: Number, default: 0, min: 0 }, // Salaire de base
    transport: { type: Number, default: 0, min: 0 }, // Prime de transport
    risk: { type: Number, default: 0, min: 0 }, // Prime de risque
    totalIndemnities: { type: Number, default: 0, min: 0 }, // Indemnité de service rendu (5% auto)
    sursalaire: { type: Number, default: 0, min: 0 }, // Sursalaire
    overtimeHours: { type: Number, default: 0, min: 0 }, // Heures supplémentaires
    grossSalary: { type: Number, default: 0, min: 0 } // Salaire brut (calculé)
  },
  // Charges salariales (retenues) simplifiées (sans CNPS et IRPP)
  deductions: {
    accompte: { type: Number, default: 0, min: 0 }, // Accompte sur salaire
    autresRetenues: { type: Number, default: 0, min: 0 }, // Autres retenues (regroupe fir, reimbursement)
    absences: { type: Number, default: 0, min: 0 }, // Absences
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
  
  // Calculer le salaire brut (somme de tous les gains)
  const grossSalary = (this.gains.baseSalary || 0) + 
                      (this.gains.transport || 0) + 
                      (this.gains.risk || 0) + 
                      (this.gains.totalIndemnities || 0) + 
                      (this.gains.sursalaire || 0) +
                      (this.gains.overtimeHours || 0);
  
  this.gains.grossSalary = grossSalary;
  
  // Le total des retenues = accompte + autresRetenues (inclut FIR, remboursements, etc.)
  const accompte = this.deductions.accompte || 0;
  const autresRetenues = this.deductions.autresRetenues || 0;
  const absences = this.deductions.absences || 0;
  this.deductions.totalRetenues = accompte + autresRetenues + absences;
  
  // Calculer le salaire net à payer = salaire brut - déductions (accompte + autresRetenues)
  // Toujours recalculer pour s'assurer que netAmount est cohérent avec les déductions
  // Cela permet aussi de prendre en compte les accomptes appliqués automatiquement
  const totalDeductions = this.deductions.totalRetenues || 0;
  this.netAmount = Math.max(0, grossSalary - totalDeductions);
  
  // S'assurer que cumulative existe
  if (!this.cumulative) {
    this.cumulative = {};
  }
  
  // Calculer les totaux cumulés (pour ce bulletin)
  this.cumulative.grossSalary = grossSalary; // Utiliser la variable grossSalary déjà calculée
  this.cumulative.employeeCharges = this.deductions.totalRetenues || 0;
  this.cumulative.employerCharges = this.employerCharges.cnpsEmployer || 0;
  this.cumulative.taxes = 0; // Plus de taxes (IRPP supprimé)
  this.cumulative.overtimeHours = this.gains.overtimeHours || 0;
  this.cumulative.netPayable = this.netAmount;
  this.cumulative.totalCost = grossSalary + (this.employerCharges.cnpsEmployer || 0);
  
  next();
});

module.exports = mongoose.model('Payroll', payrollSchema);

