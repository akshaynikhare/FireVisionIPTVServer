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

// High-volume, low-value actions we don't persist — they dominated the audit log (~81% of rows)
// and provide little forensic value. Liveness/health probing is already visible in scheduler runs.
const NOISY_ACTIONS = new Set([
  'test_channel',
  'test_channel_batch',
  'test_channel_all',
  'check_liveness_single',
  'check_liveness_batch',
]);

/** Fire-and-forget audit log entry. Never throws. */
export function audit(opts: LogOptions): void {
  if (NOISY_ACTIONS.has(opts.action)) return;

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
