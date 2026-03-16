import mongoose, { Schema } from 'mongoose';
import { ISessionDocument } from '@firevision/shared';

const sessionSchema = new Schema<ISessionDocument>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['Admin', 'User'],
      required: true,
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
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Index for automatic cleanup of expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Maximum absolute session lifetime (30 days from creation)
const MAX_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

// Update last activity and extend session expiry (sliding window with absolute cap)
sessionSchema.methods.updateActivity = function (this: ISessionDocument) {
  this.lastActivity = new Date();
  const slidingExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  // Cap at absolute max lifetime from creation
  const absoluteExpiry = new Date((this as any).createdAt.getTime() + MAX_SESSION_LIFETIME_MS);
  this.expiresAt = slidingExpiry < absoluteExpiry ? slidingExpiry : absoluteExpiry;
  return (this as any).save();
};

// Check if session is valid
sessionSchema.methods.isValid = function (this: ISessionDocument): boolean {
  return this.expiresAt > new Date();
};

const Session = mongoose.model<ISessionDocument>('Session', sessionSchema);

module.exports = Session;
export default Session;
