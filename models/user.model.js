const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: { 
    type: String,
    trim: true
  },
  passwordHash: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['super_admin', 'recruiter', 'planner', 'accountant', 'agent', 'client'],
    required: true 
  },
  customPermissions: {
    type: Schema.Types.Mixed,
    default: null
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastLogin: { 
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

// Mettre à jour updatedAt avant la sauvegarde
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
