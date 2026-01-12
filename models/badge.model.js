const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const badgeSchema = new Schema({
  badgeNumber: {
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
  // Type de badge
  badgeType: {
    type: String,
    enum: ['standard', 'visitor', 'contractor', 'temporary', 'management'],
    default: 'standard'
  },
  // Informations affichées
  displayInfo: {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    position: { type: String, trim: true },
    department: { type: String, trim: true },
    photo: { type: String }, // Chemin vers la photo
    employeeId: { type: String, trim: true },
    site: { type: String, trim: true },
    company: { type: String, default: 'PROPRENET', trim: true }
  },
  // Validité
  issueDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  expiryDate: {
    type: Date
  },
  // Badge précédent (en cas de remplacement)
  replacedBadgeId: {
    type: Schema.Types.ObjectId,
    ref: 'Badge'
  },
  // Raison du remplacement/annulation
  cancellationReason: {
    type: String,
    trim: true
  },
  // Document image généré
  badgeImagePath: {
    type: String
  },
  badgePDFPath: {
    type: String
  },
  // Accès autorisés
  accessRights: [{
    siteId: { type: Schema.Types.ObjectId, ref: 'Site' },
    accessLevel: {
      type: String,
      enum: ['full', 'restricted', 'visitor', 'readonly']
    },
    areas: [{ type: String, trim: true }] // Zones spécifiques
  }],
  // Notes
  notes: {
    type: String,
    trim: true
  },
  issuedBy: {
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
badgeSchema.index({ agentId: 1 });
badgeSchema.index({ badgeNumber: 1 });
badgeSchema.index({ expiryDate: 1 });

badgeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Badge', badgeSchema);

