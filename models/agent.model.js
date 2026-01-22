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
      const now = new Date();
      const currentMonth = now.getMonth() + 1; // 1-12
      const currentYear = now.getFullYear();
      
      // Utiliser this.constructor qui fait référence au modèle même dans le hook pre-save
      let lastAgent = null;
      
      try {
        // Trouver le dernier matricule du mois en cours (format: NNMMYYYY)
        // Exemple: 86012026 pour l'agent 86 créé en janvier 2026
        const monthPattern = String(currentMonth).padStart(2, '0');
        const yearPattern = String(currentYear);
        const regexPattern = new RegExp(`^\\d{2}${monthPattern}${yearPattern}$`);
        
        lastAgent = await this.constructor.findOne({
          matriculeNumber: regexPattern,
          _id: { $ne: this._id } // Exclure le document courant
        }).sort({ matriculeNumber: -1 });
      } catch (queryError) {
        // Fallback: utiliser la collection directement si this.constructor échoue
        try {
          const monthPattern = String(currentMonth).padStart(2, '0');
          const yearPattern = String(currentYear);
          const regexPattern = new RegExp(`^\\d{2}${monthPattern}${yearPattern}$`);
          
          lastAgent = await mongoose.connection.db.collection('agents').findOne(
            { 
              matriculeNumber: regexPattern,
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
        // Extraire le numéro du dernier matricule (format: 86012026)
        // Les 2 premiers chiffres sont le numéro de l'agent
        const agentNumberStr = lastAgent.matriculeNumber.substring(0, 2);
        const agentNumber = parseInt(agentNumberStr, 10);
        if (!isNaN(agentNumber)) {
          nextNumber = agentNumber + 1;
        }
      }
      
      // Formater le matricule: Number-Month-Year (ex: 86012026)
      // Format: NNMMYYYY où NN = numéro agent, MM = mois, YYYY = année
      const agentNumberStr = String(nextNumber).padStart(2, '0');
      const monthStr = String(currentMonth).padStart(2, '0');
      const yearStr = String(currentYear);
      this.matriculeNumber = `${agentNumberStr}${monthStr}${yearStr}`;
    } catch (error) {
      // En cas d'erreur, générer un matricule basé sur l'ID
      logger.error('Erreur génération matricule:', error);
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const fallbackNumber = String(Date.now()).slice(-2).padStart(2, '0');
      const monthStr = String(currentMonth).padStart(2, '0');
      const yearStr = String(currentYear);
      this.matriculeNumber = `${fallbackNumber}${monthStr}${yearStr}`;
    }
  }
  
  next();
});

module.exports = mongoose.model('Agent', agentSchema);

