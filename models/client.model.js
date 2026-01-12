const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const clientSchema = new Schema({
  companyName: { 
    type: String,
    trim: true,
    maxlength: 255
  },
  companyNumber: { 
    type: String,
    trim: true,
    maxlength: 255
  },
  address: { 
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  billingInfo: {
    type: Schema.Types.Mixed, // JSONB équivalent - peut contenir companyName, address, taxId, paymentTerms, etc.
    default: {}
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Client', clientSchema);

