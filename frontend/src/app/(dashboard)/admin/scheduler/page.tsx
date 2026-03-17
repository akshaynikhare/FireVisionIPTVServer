'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Clock, Play, Loader2, CheckCircle, XCircle, AlertTriangle, Timer } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import Pagination from '@/components/ui/pagination';

interface TaskInfo {
  name: string;
  displayName: string;
  description: string;
  intervalMs: number;
  lastRun: RunEntry | null;
  nextRunAt: string | null;
  isRunning: boolean;
}

interface RunEntry {
  _id: string;
  taskName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  trigger: 'scheduled' | 'manual';
  triggeredBy?: { username?: string } | null;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  result?: Record<string, unknown>;
  error?: string;
  subtasks?: {
    name: string;
    status: string;
    durationMs?: number;
    error?: string;
  }[];
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'text-signal-green bg-signal-green/10 border-signal-green/30',
  failed: 'text-signal-red bg-signal-red/10 border-signal-red/30',
  running: 'text-primary bg-primary/10 border-primary/30',
  pending: 'text-muted-foreground bg-muted border-border',
};

const TRIGGER_STYLES: Record<string, string> = {
  scheduled: 'text-muted-foreground bg-muted border-border',
  manual: 'text-primary bg-primary/10 border-primary/30',
};

function formatDuration(ms?: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatInterval(ms: number): string {
  const hours = ms / 3600000;
  if (hours < 1) return `${(ms / 60000).toFixed(0)}min`;
  if (hours === 1) return '1 hour';
  return `${hours}h`;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) {
    const absDiff = Math.abs(diff);
    if (absDiff < 60000) return 'in < 1min';
    if (absDiff < 3600000) return `in ${Math.round(absDiff / 60000)}min`;
    return `in ${(absDiff / 3600000).toFixed(1)}h`;
  }
  if (diff < 60000) return '< 1min ago';
  if (diff < 3600000) return `${Math.round(diff / 60000)}min ago`;
  if (diff < 86400000) return `${(diff / 3600000).toFixed(1)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] font-medium border ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}
    >
      {status === 'running' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {status === 'completed' && <CheckCircle className="h-2.5 w-2.5" />}
      {status === 'failed' && <XCircle className="h-2.5 w-2.5" />}
      {status}
    </span>
  );
}

const PAGE_SIZE = 15;

export default function SchedulerPage() {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [totalRuns, setTotalRuns] = useState(0);
  const [runsPage, setRunsPage] = useState(1);
  const [taskFilter, setTaskFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [triggeringTask, setTriggeringTask] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get('/scheduler/tasks');
      setTasks(res.data.data || []);
    } catch {
      // silent — tasks will show as empty
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(runsPage),
        pageSize: String(PAGE_SIZE),
      });
      if (taskFilter) params.set('taskName', taskFilter);
      const res = await api.get(`/scheduler/runs?${params}`);
      setRuns(res.data.data || []);
      setTotalRuns(res.data.totalCount || 0);
    } catch {
      // silent
    }
  }, [runsPage, taskFilter]);

  // Initial load
  useEffect(() => {
    Promise.all([fetchTasks(), fetchRuns()]).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch runs when page/filter changes
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Poll when any task is running
  useEffect(() => {
    const anyRunning = tasks.some((t) => t.isRunning);
    if (anyRunning && !pollRef.current) {
      pollRef.current = setInterval(() => {
        fetchTasks();
        fetchRuns();
      }, 5000);
    } else if (!anyRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [tasks, fetchTasks, fetchRuns]);

  async function triggerTask(taskName: string) {
    setTriggeringTask(taskName);
    try {
      await api.post(`/scheduler/trigger/${taskName}`);
      toast({ type: 'success', message: `Task '${taskName}' triggered` });
      // Refresh immediately
      await fetchTasks();
      await fetchRuns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger task';
      toast({ type: 'error', message: msg });
    } finally {
      setTriggeringTask(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading scheduler...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.08em]">Scheduler</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Background tasks, run history, and manual triggers
        </p>
      </div>

      {/* Task cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <div key={task.name} className="border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-medium truncate">{task.displayName}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
              </div>
              {task.isRunning ? (
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-[0.1em] font-medium text-primary bg-primary/10 border border-primary/30">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Running
                </span>
              ) : (
                <button
                  onClick={() => triggerTask(task.name)}
                  disabled={triggeringTask === task.name || task.isRunning}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.1em] font-medium border border-border bg-card hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  {triggeringTask === task.name ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  Run Now
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground uppercase tracking-[0.1em]">Schedule</span>
                <p className="font-medium mt-0.5 flex items-center gap-1">
                  <Timer className="h-3 w-3 text-muted-foreground" />
                  Every {formatInterval(task.intervalMs)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground uppercase tracking-[0.1em]">Next Run</span>
                <p className="font-medium mt-0.5">
                  {task.nextRunAt ? formatRelativeTime(task.nextRunAt) : 'Pending'}
                </p>
              </div>
            </div>

            {task.lastRun && (
              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground uppercase tracking-[0.1em]">Last Run</span>
                  <StatusBadge status={task.lastRun.status} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {formatRelativeTime(task.lastRun.startedAt)}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDuration(task.lastRun.durationMs)}
                  </span>
                </div>
                {task.lastRun.error && (
                  <p className="text-xs text-signal-red truncate" title={task.lastRun.error}>
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                    {task.lastRun.error}
                  </p>
                )}
              </div>
            )}

            {!task.lastRun && (
              <div className="border-t border-border pt-2">
                <p className="text-xs text-muted-foreground">No runs yet</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Run history */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-display font-bold uppercase tracking-[0.08em]">
            Run History
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={taskFilter}
              onChange={(e) => {
                setTaskFilter(e.target.value);
                setRunsPage(1);
              }}
              className="text-xs border border-border bg-card px-2 py-1.5 focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">All Tasks</option>
              {tasks.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border border-border divide-y divide-border">
          {/* Header row */}
          <div className="grid grid-cols-[1fr,100px,80px,80px,80px] sm:grid-cols-[1fr,140px,100px,80px,80px,1fr] gap-2 px-4 py-2 bg-muted/60 text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
            <span>Task</span>
            <span>Time</span>
            <span>Trigger</span>
            <span>Status</span>
            <span>Duration</span>
            <span className="hidden sm:inline">Error</span>
          </div>

          {runs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No runs found.</p>
          )}

          {runs.map((run) => {
            const taskDef = tasks.find((t) => t.name === run.taskName);
            const isExpanded = expandedRun === run._id;
            return (
              <div key={run._id}>
                <button
                  onClick={() => setExpandedRun(isExpanded ? null : run._id)}
                  className="w-full grid grid-cols-[1fr,100px,80px,80px,80px] sm:grid-cols-[1fr,140px,100px,80px,80px,1fr] gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-sm font-medium truncate">
                    {taskDef?.displayName || run.taskName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(run.startedAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] font-medium border w-fit ${TRIGGER_STYLES[run.trigger] || TRIGGER_STYLES.scheduled}`}
                  >
                    {run.trigger === 'manual' && <Clock className="h-2.5 w-2.5" />}
                    {run.trigger}
                  </span>
                  <span>
                    <StatusBadge status={run.status} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(run.durationMs)}
                  </span>
                  <span className="hidden sm:inline text-xs text-signal-red truncate">
                    {run.error || ''}
                  </span>
                </button>

                {/* Expanded subtasks */}
                {isExpanded && run.subtasks && run.subtasks.length > 0 && (
                  <div className="px-4 pb-3 bg-muted/30">
                    <div className="border border-border divide-y divide-border">
                      {run.subtasks.map((sub, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[1fr,80px,80px,1fr] gap-2 px-3 py-1.5 text-xs"
                        >
                          <span className="font-medium truncate">{sub.name}</span>
                          <StatusBadge status={sub.status} />
                          <span className="text-muted-foreground">
                            {formatDuration(sub.durationMs)}
                          </span>
                          <span className="text-signal-red truncate">{sub.error || ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Pagination
          page={runsPage}
          pageSize={PAGE_SIZE}
          totalCount={totalRuns}
          onPageChange={setRunsPage}
        />
      </div>
    </div>
  );
}
