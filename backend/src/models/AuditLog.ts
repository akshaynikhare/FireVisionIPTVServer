import mongoose, { Schema } from 'mongoose';
import { IAuditLogDocument } from '@firevision/shared';

const auditLogSchema = new Schema<IAuditLogDocument>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    // Covered by the { userId, timestamp } compound below — no standalone index.
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  resource: {
    type: String,
    required: true,
    // Covered by the { resource, timestamp } compound below — no standalone index.
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
    // Indexed ONLY via the TTL schema.index() below. A field-level `index: true` here would
    // declare a plain timestamp_1 that blocks the TTL index from ever building (same name,
    // different options) — which is exactly why retention never worked in production.
  },
});

// Compound indexes for common queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, timestamp: -1 });

// TTL index: retain audit history for 180 days, then auto-delete (prevents unbounded growth)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

const AuditLog = mongoose.model<IAuditLogDocument>('AuditLog', auditLogSchema);

module.exports = AuditLog;
export default AuditLog;
