const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const logger = require('../utils/logger');

const agentSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: false, // Rendre optionnel : les agents peuvent exister sans compte utilisateur
    unique: true,
    sparse: true // Permet plusieurs valeurs null sans violation de l'unicité
  },
  matriculeNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true
  },
  firstName: { 
    type: String, 
    required: true,
    trim: true
  },
  lastName: { 
    type: String, 
    required: true,
    trim: true
  },
  birthDate: { 
    type: Date 
  },
  maritalStatus: {
    type: String,
    enum: ['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf(ve)', 'Concubinage'],
    trim: true
  },
  address: { 
    type: String,
    trim: true
  },
  languages: [{ 
    type: String,
    trim: true
  }],
  skills: [{ 
    type: String,
    trim: true
  }],
  hourlyRate: { 
    type: Number, 
    default: 0,
    min: 0
  },
  status: { 
    type: String, 
    enum: ['available', 'assigned', 'inactive', 'under_verification'],
    default: 'under_verification'
  },
  availability: {
    monday: { available: { type: Boolean, default: false }, hours: { start: String, end: String } },
    tuesday: { available: { type: Boolean, default: false }, hours: { start: String, end: String } },
    wednesday: { available: { type: Boolean, default: false }, hours: { start: String, end: String } },
    thursday: { available: { type: Boolean, default: false }, hours: { start: String, end: String } },
    friday: { available: { type: Boolean, default: false }, hours: { start: String, end: String } },
    saturday: { available: { type: Boolean, default: false }, hours: { start: String, end: String } },
    sunday: { available: { type: Boolean, default: false }, hours: { start: String, end: String } }
  },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  // Pièce d'identité
  identityDocument: {
    type: {
      type: String,
      enum: ['CNI', 'Passeport', 'Carte consulaire', 'Permis de conduire', 'Autre'],
      trim: true
    },
    number: {
      type: String,
      trim: true
    },
    issuedDate: {
      type: Date
    },
    issuedAt: {
      type: String,
      trim: true
    }
  },
  // Mode de paiement
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash'],
    default: 'bank_transfer'
  },
  // Informations bancaires (obligatoires seulement si paymentMethod === 'bank_transfer')
  bankAccount: {
    bankId: {
      type: Schema.Types.ObjectId,
      ref: 'Bank',
      required: false, // Rendre optionnel
      index: true
    },
    accountNumber: {
      type: String,
      required: false, // Rendre optionnel
      trim: true
    }
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

// Index pour les recherches par statut et compétences
agentSchema.index({ status: 1, skills: 1 });
agentSchema.index({ matriculeNumber: 1 });

// Générer automatiquement le numéro de matricule avant la sauvegarde
agentSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  // Validation : si le mode de paiement est 'bank_transfer', les informations bancaires sont obligatoires
  if (this.paymentMethod === 'bank_transfer') {
    if (!this.bankAccount || !this.bankAccount.bankId || !this.bankAccount.accountNumber) {
      return next(new Error('Les informations bancaires sont obligatoires lorsque le mode de paiement est "Virement bancaire"'));
    }
  }
  
  // Si le mode de paiement est 'cash', supprimer complètement les informations bancaires
  if (this.paymentMethod === 'cash') {
    this.bankAccount = undefined;
  }
  
  // Générer le matricule uniquement si ce n'est pas déjà défini et si c'est un nouveau document
  if ((!this.matriculeNumber || this.matriculeNumber === '') && this.isNew) {
    try {
      const currentYear = new Date().getFullYear();
      
      // Utiliser directement mongoose.model pour éviter les problèmes de référence circulaire
      // Note: mongoose.models.Agent sera disponible après la première compilation du modèle
      const AgentModel = mongoose.models.Agent;
      
      // Utiliser this.constructor qui fait référence au modèle même dans le hook pre-save
      let lastAgent = null;
      
      try {
        // Trouver le dernier matricule de l'année en cours
        lastAgent = await this.constructor.findOne({
          matriculeNumber: new RegExp(`^\\d{3}/PNET/${currentYear}$`),
          _id: { $ne: this._id } // Exclure le document courant
        }).sort({ matriculeNumber: -1 });
      } catch (queryError) {
        // Fallback: utiliser la collection directement si this.constructor échoue
        try {
          lastAgent = await mongoose.connection.db.collection('agents').findOne(
            { 
              matriculeNumber: new RegExp(`^\\d{3}/PNET/${currentYear}$`),
              _id: { $ne: this._id }
            },
            { sort: { matriculeNumber: -1 } }
          );
        } catch (fallbackError) {
          logger.warn('Impossible de récupérer le dernier matricule, utilisation du numéro 1');
        }
      }
      
      let nextNumber = 1;
      
      if (lastAgent && lastAgent.matriculeNumber) {
        // Extraire le numéro du dernier matricule (format: 090/PNET/2025)
        const parts = lastAgent.matriculeNumber.split('/');
        if (parts.length === 3 && parts[1] === 'PNET' && parts[2] === String(currentYear)) {
          nextNumber = parseInt(parts[0], 10) + 1;
        }
      }
      
      // Formater le numéro avec 3 chiffres (001, 002, ..., 090, etc.)
      this.matriculeNumber = `${String(nextNumber).padStart(3, '0')}/PNET/${currentYear}`;
    } catch (error) {
      // En cas d'erreur, générer un matricule basé sur l'ID
      logger.error('Erreur génération matricule:', error);
      const currentYear = new Date().getFullYear();
      const fallbackNumber = String(Date.now()).slice(-3);
      this.matriculeNumber = `${fallbackNumber}/PNET/${currentYear}`;
    }
  }
  
  next();
});

module.exports = mongoose.model('Agent', agentSchema);

