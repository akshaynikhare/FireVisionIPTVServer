import { Types, Document } from 'mongoose';

export interface IAuditLog {
  userId: Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  };
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  timestamp: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {
  _id: Types.ObjectId;
}
