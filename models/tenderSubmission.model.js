const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tenderSubmissionSchema = new Schema({
  tenderReference: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  submissionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  companyInfo: {
    companyName: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    rccm: { type: String, required: true }, // Numéro RCCM
    ifu: { type: String, required: true }, // Numéro IFU
    capital: { type: String },
    legalRepresentative: { type: String, required: true }
  },
  technicalOffer: {
    organization: {
      plannedStaff: { type: Number },
      frequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
      schedules: { type: String },
      equipment: { type: String },
      products: { type: String }
    },
    hse: {
      products: { type: String },
      equipment: { type: String },
      wasteManagement: { type: String },
      training: { type: String }
    },
    executionPlan: {
      steps: [{
        activity: String,
        duration: String,
        responsible: String
      }]
    },
    team: [{
      name: String,
      function: String,
      experience: String,
      training: String
    }]
  },
  financialOffer: {
    items: [{
      designation: { type: String, required: true },
      unit: { type: String, required: true },
      quantity: { type: Number, required: true },
      unitPrice: { type: Number, required: true },
      total: { type: Number, required: true }
    }],
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    taxRate: { type: Number, default: 18 }, // TVA par défaut 18%
    total: { type: Number, required: true },
    currency: { type: String, default: 'FCFA' }
  },
  documents: [{
    type: { 
      type: String, 
      enum: ['rccm', 'cnps', 'tax_attestation', 'references', 'staff_list', 'equipment_list', 'hse_plan', 'technical_sheet', 'engagement_letter', 'non_bankruptcy'],
      required: true
    },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'accepted', 'rejected'],
    default: 'draft',
    index: true
  },
  submittedAt: {
    type: Date
  },
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String
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
tenderSubmissionSchema.index({ tenderReference: 1, status: 1 });
tenderSubmissionSchema.index({ 'companyInfo.rccm': 1 });
tenderSubmissionSchema.index({ submissionDate: -1 });

// Mettre à jour updatedAt avant la sauvegarde
tenderSubmissionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('TenderSubmission', tenderSubmissionSchema);


