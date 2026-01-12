const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const documentSchema = new Schema({
  agentId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Agent',
    index: true
  },
  clientId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Client',
    index: true
  },
  docType: { 
    type: String, 
    required: true,
    enum: ['cni', 'casier_judiciaire', 'photo', 'certificat_sante', 'reference', 'contrat', 'autre'],
    trim: true
  },
  fileName: {
    type: String,
    required: true
  },
  filePath: { 
    type: String, 
    required: true
  },
  fileSize: {
    type: Number
  },
  mimeType: {
    type: String
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  expiryDate: {
    type: Date
  },
  uploadedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Index pour les recherches par agent et type de document
documentSchema.index({ agentId: 1, docType: 1 });
documentSchema.index({ clientId: 1, docType: 1 });

module.exports = mongoose.model('Document', documentSchema);

