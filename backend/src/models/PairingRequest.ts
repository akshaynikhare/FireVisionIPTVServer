import { randomInt } from 'crypto';
import mongoose, { Schema, Model } from 'mongoose';
import { IPairingRequestDocument, IPairingRequestModel } from '@firevision/shared';

const pairingRequestSchema = new Schema<IPairingRequestDocument>(
  {
    pin: {
      type: String,
      required: true,
    },
    deviceName: {
      type: String,
      default: 'Unknown Device',
    },
    deviceModel: {
      type: String,
      default: 'Unknown Model',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'expired'],
      default: 'pending',
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Create TTL index to automatically delete expired requests after 1 hour
pairingRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

// Uniqueness only matters among active (pending) PINs — retained completed/expired
// records shouldn't cause spurious E11000 on newly generated PINs.
pairingRequestSchema.index(
  { pin: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

// Static method to generate unique 6-digit PIN
// Bounded retries to prevent infinite loops under contention.
pairingRequestSchema.statics.generatePin = async function (): Promise<string> {
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const pin = randomInt(100000, 1000000).toString();

    const existing = await this.findOne({
      pin,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (!existing) {
      return pin;
    }
  }

  throw new Error('Failed to generate unique PIN after maximum attempts');
};

// Instance method to check if request is expired
pairingRequestSchema.methods.isExpired = function (this: IPairingRequestDocument): boolean {
  return new Date() > this.expiresAt;
};

// Instance method to mark as expired
pairingRequestSchema.methods.markExpired = async function (
  this: IPairingRequestDocument,
): Promise<void> {
  this.status = 'expired';
  await (this as any).save();
};

const PairingRequest = mongoose.model<
  IPairingRequestDocument,
  Model<IPairingRequestDocument> & IPairingRequestModel
>('PairingRequest', pairingRequestSchema);

module.exports = PairingRequest;
export default PairingRequest;
