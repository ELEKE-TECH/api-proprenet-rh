const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const logger = require('../utils/logger');

const purchaseOrderItemSchema = new Schema({
  productName: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit: {
    type: String,
    default: 'unité'
  },
  unitPrice: {
    type: Number,
    required: false,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: false,
    min: 0
  },
  description: {
    type: String,
    trim: true
  }
}, { _id: true });

const purchaseOrderSchema = new Schema({
  type: {
    type: String,
    enum: ['order', 'quote_request'],
    default: 'order',
    required: true,
    index: true
  },
  orderNumber: {
    type: String,
    unique: true,
    trim: true,
    sparse: true,
    index: true
  },
  orderDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  expectedDeliveryDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  },
  supplier: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    contact: {
      phone: {
        type: String,
        trim: true
      },
      email: {
        type: String,
        trim: true
      },
      address: {
        type: String,
        trim: true
      }
    }
  },
  items: [purchaseOrderItemSchema],
  subtotal: {
    type: Number,
    default: 0,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: false,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'FCFA'
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'confirmed', 'received', 'cancelled'],
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
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
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
purchaseOrderSchema.index({ orderDate: -1 });
purchaseOrderSchema.index({ status: 1, orderDate: -1 });
purchaseOrderSchema.index({ 'supplier.name': 1 });

// Générer automatiquement le numéro de commande avant la sauvegarde
purchaseOrderSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  // Générer le numéro de commande uniquement si ce n'est pas déjà défini
  if ((!this.orderNumber || this.orderNumber === '') && this.isNew) {
    try {
      const currentYear = new Date().getFullYear();
      const prefix = this.type === 'quote_request' ? 'DE-' : 'BC-';
      const count = await mongoose.models.PurchaseOrder.countDocuments({
        orderNumber: new RegExp(`^${prefix}${currentYear}-`),
        type: this.type
      });
      
      const nextNumber = count + 1;
      this.orderNumber = `${prefix}${currentYear}-${String(nextNumber).padStart(6, '0')}`;
    } catch (error) {
      logger.error('Erreur génération numéro de commande:', error);
      const currentYear = new Date().getFullYear();
      const prefix = this.type === 'quote_request' ? 'DE-' : 'BC-';
      const fallbackNumber = String(Date.now()).slice(-6);
      this.orderNumber = `${prefix}${currentYear}-${fallbackNumber}`;
    }
  }
  
  // Calculer le subtotal et le total seulement pour les commandes (pas pour les demandes de devis)
  if (this.type === 'order' && this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => {
      const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
      item.totalPrice = itemTotal;
      return sum + itemTotal;
    }, 0);
    
    this.totalAmount = this.subtotal + (this.tax || 0);
  } else if (this.type === 'quote_request') {
    // Pour les demandes de devis, mettre les totaux à 0
    this.subtotal = 0;
    this.totalAmount = 0;
  }
  
  next();
});

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);

