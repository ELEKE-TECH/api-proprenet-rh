const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const logger = require('../utils/logger');
const { numberToWords } = require('../utils/numberToWords');

// Schéma pour les employés dans la liste nominative
const employeeSchema = new Schema({
  number: { type: Number, required: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  matricule: { type: String, trim: true },
  fonction: { type: String, trim: true },
  service: { type: String, trim: true },
  accountType: { type: String, trim: true }, // Type de compte bancaire
  accountNumber: { type: String, trim: true }, // Numéro de compte bancaire
  contactNumber: { type: String, trim: true },
  amount: { type: Number, required: true, min: 0 },
  agentId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Agent',
    required: false
  },
  payrollId: {
    type: Schema.Types.ObjectId,
    ref: 'Payroll',
    required: false
  }
}, { _id: false });

const bankTransferOrderSchema = new Schema({
  orderNumber: {
    type: String,
    unique: true,
    trim: true,
    sparse: true,
    index: true
  },
  bank: {
    type: String,
    default: 'CORIS BANK INTERNATIONAL',
    trim: true
  },
  subject: {
    type: String,
    default: 'Virement des salaires',
    trim: true
  },
  period: {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true }
  },
  // Donneur d'ordre
  orderer: {
    company: { type: String, default: 'PROPRENET', trim: true },
    accountNumber: { type: String, required: true, trim: true },
    bank: { type: String, default: 'CORIS BANK INTERNATIONAL', trim: true },
    agency: { type: String, trim: true }
  },
  // Bénéficiaires
  employees: [employeeSchema],
  // Montant total
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  totalAmountInWords: {
    type: String,
    trim: true
  },
  // Date d'exécution souhaitée
  executionDate: {
    type: Date,
    required: true
  },
  // Lieu et date de création
  location: {
    type: String,
    default: 'N\'Djamena',
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour les recherches
bankTransferOrderSchema.index({ 'period.year': -1, 'period.month': -1 });
bankTransferOrderSchema.index({ createdAt: -1 });

// Générer automatiquement le numéro d'ordre avant la sauvegarde
bankTransferOrderSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  // Générer le numéro d'ordre uniquement si ce n'est pas déjà défini
  if ((!this.orderNumber || this.orderNumber === '') && this.isNew) {
    try {
      // Utiliser this.constructor pour accéder au modèle
      const BankTransferOrderModel = this.constructor;
      const currentYear = new Date().getFullYear();
      const count = await BankTransferOrderModel.countDocuments({
        orderNumber: new RegExp(`^ORD-VIR/${currentYear}/`)
      });
      
      const nextNumber = count + 1;
      // Formater avec 4 chiffres (ex: 0001, 0015, 0123, 1234)
      const formattedNumber = String(nextNumber).padStart(4, '0');
      this.orderNumber = `ORD-VIR/${currentYear}/${formattedNumber}`;
    } catch (error) {
      logger.error('Erreur génération numéro d\'ordre de virement:', error);
      const currentYear = new Date().getFullYear();
      const fallbackNumber = String(Date.now()).slice(-4).padStart(4, '0');
      this.orderNumber = `ORD-VIR/${currentYear}/${fallbackNumber}`;
    }
  }
  
  // Calculer le montant total si les employés sont présents
  if (this.employees && this.employees.length > 0) {
    const total = this.employees.reduce((sum, emp) => sum + (emp.amount || 0), 0);
    this.totalAmount = Math.round(total);
    
    // Générer le montant en lettres
        if (this.totalAmount && this.totalAmount > 0) {
          try {
            // S'assurer que le montant est arrondi et converti correctement
            const roundedAmount = Math.floor(Math.abs(this.totalAmount));
            
            // Validation: s'assurer que le montant est valide
            if (isNaN(roundedAmount) || roundedAmount < 0) {
              logger.warn(`Montant invalide pour conversion: ${this.totalAmount}`);
              return;
            }
            
            // Générer le montant en lettres avec la fonction corrigée
            this.totalAmountInWords = numberToWords(roundedAmount);
            
            // Vérification de cohérence (optionnel, pour détecter les problèmes)
            if (this.totalAmountInWords && this.totalAmountInWords.length < 5) {
              logger.warn(`Montant en lettres suspect pour ${roundedAmount}: "${this.totalAmountInWords}"`);
            }
            
            logger.debug(`Montant converti: ${roundedAmount} -> ${this.totalAmountInWords}`);
          } catch (error) {
            logger.error('Erreur génération montant en lettres:', error);
            // En cas d'erreur, ne pas bloquer la sauvegarde mais logger l'erreur
            // Ne pas définir totalAmountInWords pour forcer la régénération plus tard
            this.totalAmountInWords = undefined;
          }
        }
  }
  
  next();
});

module.exports = mongoose.model('BankTransferOrder', bankTransferOrderSchema);
