import mongoose, { Schema } from 'mongoose';
import { IRefreshTokenDocument } from '@firevision/shared';

const refreshTokenSchema = new Schema<IRefreshTokenDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    userAgent: String,
    ipAddress: String,
  },
  {
    timestamps: true,
  },
);

// TTL index: auto-delete tokens once they expire (prevents unbounded growth)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

refreshTokenSchema.methods.isActive = function (this: IRefreshTokenDocument): boolean {
  return !this.revokedAt && this.expiresAt > new Date();
};

const RefreshToken = mongoose.model<IRefreshTokenDocument>('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
export default RefreshToken;
