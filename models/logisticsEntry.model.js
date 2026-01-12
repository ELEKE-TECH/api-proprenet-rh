const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const logisticsEntrySchema = new Schema({
  entryNumber: {
    type: String,
    unique: true,
    trim: true,
    index: true
  },
  materialId: {
    type: Schema.Types.ObjectId,
    ref: 'Material',
    required: false, // Optionnel pour permettre les entrées de produits libres
    index: true
  },
  productName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    default: 'unité'
  },
  unitPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  entryDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  entryType: {
    type: String,
    enum: ['purchase', 'transfer', 'return', 'adjustment', 'other'],
    default: 'purchase'
  },
  purchaseOrderId: {
    type: Schema.Types.ObjectId,
    ref: 'PurchaseOrder',
    required: false,
    index: true
  },
  siteId: {
    type: Schema.Types.ObjectId,
    ref: 'Site',
    required: false, // Optionnel : les entrées vont au magasin général
    index: true
  },
  supplier: {
    name: String,
    contact: {
      phone: String,
      email: String
    }
  },
  receivedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    trim: true
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
logisticsEntrySchema.index({ entryNumber: 1 });
logisticsEntrySchema.index({ materialId: 1, entryDate: -1 });
logisticsEntrySchema.index({ productName: 1, entryDate: -1 });
logisticsEntrySchema.index({ siteId: 1, entryDate: -1 });
logisticsEntrySchema.index({ purchaseOrderId: 1 });
logisticsEntrySchema.index({ entryType: 1, entryDate: -1 });

// Générer automatiquement le numéro d'entrée si non fourni
logisticsEntrySchema.pre('save', async function(next) {
  try {
    if (!this.entryNumber) {
      const LogisticsEntryModel = mongoose.models.LogisticsEntry || mongoose.model('LogisticsEntry', logisticsEntrySchema);
      const count = await LogisticsEntryModel.countDocuments();
      const year = new Date().getFullYear();
      this.entryNumber = `ENT-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    
    // Calculer le prix total si unitPrice est fourni
    if (this.unitPrice && this.quantity) {
      this.totalPrice = this.unitPrice * this.quantity;
    }
    
    this.updatedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('LogisticsEntry', logisticsEntrySchema);

