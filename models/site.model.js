const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const siteSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  code: {
    type: String,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['office', 'warehouse', 'retail', 'residential', 'commercial', 'industrial', 'other'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active',
    index: true
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  // Prix mensuel facturé au client pour ce site
  monthlyPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  capacity: {
    type: Number,
    min: 0
  },
  contactInfo: {
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    manager: {
      type: String,
      trim: true
    }
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    },
    address: {
      type: String,
      trim: true
    }
  },
  agents: [{
    type: Schema.Types.ObjectId,
    ref: 'Agent'
  }],
  // Planning des tâches
  taskPlanning: [{
    taskName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Agent' },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'as_needed'],
      default: 'daily'
    },
    schedule: {
      dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Dimanche, 6 = Samedi
      time: { type: String }, // Format HH:MM
      duration: { type: Number, default: 60 } // en minutes
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'cancelled'],
      default: 'active'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    estimatedDuration: { type: Number, default: 60 }, // en minutes
    lastCompleted: { type: Date },
    nextDue: { type: Date },
    notes: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index géospatial pour les recherches par localisation
siteSchema.index({ location: '2dsphere' });

// Index pour les recherches par client, statut et type
siteSchema.index({ clientId: 1, status: 1 });
siteSchema.index({ clientId: 1, type: 1 });

// Mettre à jour updatedAt avant la sauvegarde
siteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Site', siteSchema);
