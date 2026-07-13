import mongoose, { Schema } from 'mongoose';
import { IAuditLogDocument } from '@firevision/shared';

const auditLogSchema = new Schema<IAuditLogDocument>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  resource: {
    type: String,
    required: true,
    index: true,
  },
  resourceId: {
    type: String,
  },
  changes: {
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  status: {
    type: String,
    enum: ['success', 'failure'],
    required: true,
  },
  errorMessage: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound indexes for common queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, timestamp: -1 });

// TTL index: retain audit history for 1 year, then auto-delete (prevents unbounded growth)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });

const AuditLog = mongoose.model<IAuditLogDocument>('AuditLog', auditLogSchema);

module.exports = AuditLog;
export default AuditLog;
