const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const logger = require('../utils/logger');

const invoiceItemSchema = new Schema({
  designation: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.01
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: true });

const invoiceSchema = new Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    trim: true,
    sparse: true,
    index: true
  },
  period: {
    type: String,
    required: true,
    trim: true
  },
  invoiceDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  clientDescription: {
    type: String,
    trim: true
  },
  clientNIF: {
    type: String,
    trim: true
  },
  clientNumber: {
    type: String,
    trim: true
  },
  items: [invoiceItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  // TVA (Taxe sur la Valeur Ajoutée)
  vatRate: {
    type: Number,
    default: 19.25, // Taux de TVA par défaut au Tchad (19,25%)
    min: 0,
    max: 100
  },
  totalAmountInWords: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'cancelled'],
    default: 'draft',
    index: true
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ status: 1, invoiceDate: -1 });
invoiceSchema.index({ clientId: 1 });

// Générer automatiquement le numéro de facture avant la sauvegarde
invoiceSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  // Générer le numéro de facture uniquement si ce n'est pas déjà défini
  if ((!this.invoiceNumber || this.invoiceNumber === '') && this.isNew) {
    try {
      const currentYear = new Date().getFullYear();
      const count = await mongoose.models.Invoice.countDocuments({
        invoiceNumber: new RegExp(`^[0-9]+/SAF/PNET/${currentYear}$`)
      });
      
      const nextNumber = count + 1;
      this.invoiceNumber = `${nextNumber}/SAF/PNET/${currentYear}`;
    } catch (error) {
      logger.error('Erreur génération numéro de facture:', error);
      const currentYear = new Date().getFullYear();
      const fallbackNumber = String(Date.now()).slice(-3);
      this.invoiceNumber = `${fallbackNumber}/SAF/PNET/${currentYear}`;
    }
  }
  
  // Calculer le total si les items sont présents
  if (this.items && this.items.length > 0) {
    // Total HT = somme des items (arrondi à l'unité près)
    const rawTotalHT = this.items.reduce((sum, item) => {
      const quantity = item.quantity || 0;
      const unitPrice = item.unitPrice || 0;
      const itemTotal = quantity * unitPrice;
      // Stocker le total de ligne arrondi à l'unité (pas de décimales)
      item.totalPrice = Math.round(itemTotal);
      return sum + itemTotal;
    }, 0);

    const totalHT = Math.round(rawTotalHT);
    
    // Calculer la TVA et le Total TTC (arrondis à l'unité)
    const vatRate = this.vatRate || 19.25; // Taux de TVA par défaut 19,25%
    const rawVatAmount = (totalHT * vatRate) / 100;
    const vatAmount = Math.round(rawVatAmount);
    const totalTTC = totalHT + vatAmount;
    
    // Le totalAmount stocké est le Total TTC (sans décimales)
    this.totalAmount = totalTTC;
    
    // Toujours régénérer le montant en lettres basé sur le TTC pour s'assurer de la cohérence
    if (this.totalAmount) {
      try {
        const { numberToWords } = require('../utils/numberToWords');
        this.totalAmountInWords = numberToWords(Math.floor(this.totalAmount));
      } catch (error) {
        logger.error('Erreur génération montant en lettres:', error);
      }
    }
  }
  
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
