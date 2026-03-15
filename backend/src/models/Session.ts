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

// Update last activity on access
sessionSchema.methods.updateActivity = function (this: ISessionDocument) {
  this.lastActivity = new Date();
  return (this as any).save();
};

// Check if session is valid
sessionSchema.methods.isValid = function (this: ISessionDocument): boolean {
  return this.expiresAt > new Date();
};

const Session = mongoose.model<ISessionDocument>('Session', sessionSchema);

module.exports = Session;
export default Session;
