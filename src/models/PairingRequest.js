const mongoose = require('mongoose');

const pairingRequestSchema = new mongoose.Schema({
  pin: {
    type: String,
    required: true,
    unique: true,
    length: 6,
    index: true
  },
  deviceName: {
    type: String,
    default: 'Unknown Device'
  },
  deviceModel: {
    type: String,
    default: 'Unknown Model'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'expired'],
    default: 'pending',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Create TTL index to automatically delete expired requests after 1 hour
pairingRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

// Static method to generate unique 6-digit PIN
pairingRequestSchema.statics.generatePin = async function() {
  let pin;
  let exists = true;
  
  while (exists) {
    // Generate 6-digit numeric PIN
    pin = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Check if PIN already exists and is not expired
    const existing = await this.findOne({
      pin,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });
    
    exists = !!existing;
  }
  
  return pin;
};

// Instance method to check if request is expired
pairingRequestSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Instance method to mark as expired
pairingRequestSchema.methods.markExpired = async function() {
  this.status = 'expired';
  await this.save();
};

const PairingRequest = mongoose.model('PairingRequest', pairingRequestSchema);

module.exports = PairingRequest;
