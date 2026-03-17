// This file is deprecated — scheduler logic has moved to:
// - scheduler-service.ts (core runner with DB tracking)
// - task-registry.ts (task definitions including liveness handler)
// Kept temporarily for any external references. Safe to delete.

class LivenessScheduler {
  async initializeOnStartup(): Promise<void> {
    console.log('[liveness-scheduler] Delegated to scheduler-service');
  }

  stopBackgroundUpdates(): void {
    // no-op
  }
}

export const livenessScheduler = new LivenessScheduler();

module.exports = { livenessScheduler, LivenessScheduler };
