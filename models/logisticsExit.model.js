const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const logisticsExitSchema = new Schema({
  exitNumber: {
    type: String,
    unique: true,
    trim: true,
    index: true
  },
  materialId: {
    type: Schema.Types.ObjectId,
    ref: 'Material',
    required: false, // Optionnel car on peut avoir des produits sans matériel référencé
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
  exitDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  exitType: {
    type: String,
    enum: ['transfer', 'agent_assignment', 'consumption', 'damage', 'adjustment', 'other'],
    default: 'transfer'
  },
  sourceSiteId: {
    type: Schema.Types.ObjectId,
    ref: 'Site',
    required: false, // Optionnel : null = magasin, sinon un site spécifique
    index: true
  },
  destinationType: {
    type: String,
    enum: ['site', 'agent'],
    required: true
  },
  destinationSiteId: {
    type: Schema.Types.ObjectId,
    ref: 'Site',
    index: true
  },
  agentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent',
    index: true
  },
  authorizedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  documentPath: {
    type: String
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
logisticsExitSchema.index({ exitNumber: 1 });
logisticsExitSchema.index({ materialId: 1, exitDate: -1 });
logisticsExitSchema.index({ productName: 1, exitDate: -1 });
logisticsExitSchema.index({ destinationSiteId: 1, exitDate: -1 });
logisticsExitSchema.index({ sourceSiteId: 1, exitDate: -1 });
logisticsExitSchema.index({ agentId: 1, exitDate: -1 });
logisticsExitSchema.index({ exitType: 1, exitDate: -1 });

// Générer automatiquement le numéro de sortie si non fourni
logisticsExitSchema.pre('save', async function(next) {
  try {
    if (!this.exitNumber) {
      const LogisticsExitModel = mongoose.models.LogisticsExit || mongoose.model('LogisticsExit', logisticsExitSchema);
      const count = await LogisticsExitModel.countDocuments();
      const year = new Date().getFullYear();
      this.exitNumber = `SORT-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    
    this.updatedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('LogisticsExit', logisticsExitSchema);

