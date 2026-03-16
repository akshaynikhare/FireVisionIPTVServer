import AuditLog from '../models/AuditLog';

interface LogOptions {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: { before?: any; after?: any };
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failure';
  errorMessage?: string;
}

/** Fire-and-forget audit log entry. Never throws. */
export function audit(opts: LogOptions): void {
  AuditLog.create({
    userId: opts.userId,
    action: opts.action,
    resource: opts.resource,
    resourceId: opts.resourceId,
    changes: opts.changes,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    status: opts.status || 'success',
    errorMessage: opts.errorMessage,
  }).catch((err: Error) => {
    console.error('[audit] Failed to write audit log:', err.message);
  });
}

/** Helper to extract common request context */
export function reqCtx(req: any) {
  return {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
  };
}

module.exports = { audit, reqCtx };
