const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const advanceSchema = new Schema({
  agentId: {
    type: Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  remaining: {
    type: Number,
    required: true,
    min: 0
  },
  monthlyRecovery: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['requested', 'approved', 'rejected', 'closed'],
    default: 'requested',
    index: true
  },
  notes: {
    type: String,
    trim: true
  },
  requestedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date },
  closedAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

advanceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Advance', advanceSchema);

