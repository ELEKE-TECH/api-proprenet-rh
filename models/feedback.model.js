const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const feedbackSchema = new Schema({
  agentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true
  },
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: false,
    index: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true
  },
  categories: {
    punctuality: { type: Number, min: 1, max: 5 },
    quality: { type: Number, min: 1, max: 5 },
    professionalism: { type: Number, min: 1, max: 5 },
    communication: { type: Number, min: 1, max: 5 }
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  respondedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  response: {
    type: String,
    trim: true
  },
  responseAt: {
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

// Index pour les recherches par agent et note
feedbackSchema.index({ agentId: 1, rating: -1 });
feedbackSchema.index({ clientId: 1, createdAt: -1 });

// Mettre à jour updatedAt avant la sauvegarde
feedbackSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Feedback', feedbackSchema);

