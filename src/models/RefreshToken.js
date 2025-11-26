const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  revokedAt: {
    type: Date,
    default: null
  },
  userAgent: String,
  ipAddress: String
}, {
  timestamps: true
});

refreshTokenSchema.methods.isActive = function () {
  return !this.revokedAt && this.expiresAt > new Date();
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
