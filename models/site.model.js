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

// Mettre à jour updatedAt avant la sauvegarde et nettoyer le format location
siteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Nettoyer le format location pour s'assurer qu'il est au format GeoJSON valide
  // Retirer le champ 'address' s'il existe dans location (il doit être au niveau racine)
  if (this.location && typeof this.location === 'object') {
    // S'assurer que location a le format GeoJSON valide
    if (!this.location.type) {
      this.location.type = 'Point';
    }
    if (!this.location.coordinates || !Array.isArray(this.location.coordinates)) {
      this.location.coordinates = [0, 0];
    }
    // Retirer le champ address s'il existe dans location (non valide pour GeoJSON)
    if (this.location.address !== undefined) {
      delete this.location.address;
    }
  }
  
  next();
});

// Hook pre-update pour nettoyer le format location lors des mises à jour
siteSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function(next) {
  const update = this.getUpdate();
  
  // Nettoyer location dans $set
  if (update && update.$set && update.$set.location) {
    const location = update.$set.location;
    // Retirer le champ address s'il existe dans location
    if (location && typeof location === 'object' && location.address !== undefined) {
      delete location.address;
    }
    // S'assurer que location a le format GeoJSON valide
    if (location && typeof location === 'object') {
      if (!location.type) {
        location.type = 'Point';
      }
      if (!location.coordinates || !Array.isArray(location.coordinates)) {
        location.coordinates = [0, 0];
      }
    }
  }
  
  // Nettoyer location dans update direct (sans $set)
  if (update && update.location && typeof update.location === 'object') {
    const location = update.location;
    if (location.address !== undefined) {
      delete location.address;
    }
    if (!location.type) {
      location.type = 'Point';
    }
    if (!location.coordinates || !Array.isArray(location.coordinates)) {
      location.coordinates = [0, 0];
    }
  }
  
  next();
});

module.exports = mongoose.model('Site', siteSchema);
