'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Search } from 'lucide-react';
import api from '@/lib/api';
import Pagination from '@/components/ui/pagination';
import ColumnFilter from '@/components/ui/column-filter';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import DataTable, { type DataTableColumn } from '@/components/ui/data-table';

interface AuditEntry {
  _id: string;
  userId?: { username?: string; email?: string };
  action: string;
  resource: string;
  resourceId?: string;
  status: 'success' | 'failure';
  ipAddress?: string;
  timestamp: string;
}

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  register: 'Register',
  change_password: 'Change Password',
  create_channel: 'Create Channel',
  update_channel: 'Update Channel',
  delete_channel: 'Delete Channel',
  delete_all_channels: 'Delete All Channels',
  import_m3u: 'Import M3U',
  import_iptv_org: 'Import IPTV-org',
  import_iptv_org_user: 'Import (User)',
  create_user: 'Create User',
  update_user: 'Update User',
  delete_user: 'Delete User',
};

function formatLabel(action: string) {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ');
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { search, debouncedSearch, handleSearchChange } = useDebouncedSearch();
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const [filterOptions, setFilterOptions] = useState<{
    action: string[];
    resource: string[];
    status: string[];
  }>({ action: [], resource: [], status: [] });
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const fetchLogs = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (selectedActions.length > 0 && selectedActions.length < filterOptions.action.length) {
          params.set('action', selectedActions.join(','));
        }
        if (
          selectedResources.length > 0 &&
          selectedResources.length < filterOptions.resource.length
        ) {
          params.set('resource', selectedResources.join(','));
        }
        if (selectedStatuses.length > 0 && selectedStatuses.length < filterOptions.status.length) {
          params.set('status', selectedStatuses.join(','));
        }

        const res = await api.get(`/activity?${params.toString()}`, { signal });
        const data = res.data?.data || res.data;
        setLogs(data.logs || []);
        setTotalCount(data.totalCount || 0);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'CanceledError')
          setError('Failed to load activity logs');
      } finally {
        setLoading(false);
      }
    },
    [page, debouncedSearch, selectedActions, selectedResources, selectedStatuses, filterOptions],
  );

  useEffect(() => {
    const controller = new AbortController();
    api
      .get('/activity/filter-options', { signal: controller.signal })
      .then((res) => {
        setFilterOptions(res.data?.data || { action: [], resource: [], status: [] });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchLogs(controller.signal);
    return () => controller.abort();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedActions, selectedResources, selectedStatuses]);

  return (
    <div className="space-y-6">
      <div className="">
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Activity Log</h1>
        <h2 className="text-sm text-muted-foreground mt-1">
          System-wide audit trail of all actions
        </h2>
      </div>

      {error && (
        <div
          role="alert"
          className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-2 border border-border bg-muted/30">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search activity..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          aria-label="Search activity logs"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable<AuditEntry>
          data={logs}
          gridTemplate="100px 140px 140px minmax(120px,1fr) 120px 120px"
          resizable
          ariaLabel="Activity log table"
          emptyMessage="No activity logs found"
          rowKey={(log) => log._id}
          rowAriaLabel={(log) =>
            `${formatLabel(log.action)} by ${log.userId?.username || 'unknown'}`
          }
          columns={
            [
              {
                key: 'time',
                headerClassName: 'text-xs uppercase tracking-[0.15em] text-muted-foreground',
                header: 'Time',
                cell: (log) => (
                  <div className="text-xs tabular-nums text-muted-foreground">
                    <time dateTime={log.timestamp}>
                      <span className="font-medium">{formatTime(log.timestamp)}</span>
                    </time>
                    <time dateTime={log.timestamp} className="ml-1.5 text-muted-foreground/60">
                      {formatDate(log.timestamp)}
                    </time>
                  </div>
                ),
              },
              {
                key: 'user',
                headerClassName: 'text-xs uppercase tracking-[0.15em] text-muted-foreground',
                header: 'User',
                cell: (log) => (
                  <span className="text-sm truncate">{log.userId?.username || '—'}</span>
                ),
              },
              {
                key: 'action',
                headerClassName:
                  'text-xs uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1',
                header: (
                  <ColumnFilter
                    label="Action"
                    options={filterOptions.action.map((a) => formatLabel(a))}
                    selected={selectedActions.map((a) => formatLabel(a))}
                    onChange={(labels) => {
                      const reverseMap = Object.fromEntries(
                        filterOptions.action.map((a) => [formatLabel(a), a]),
                      );
                      setSelectedActions(labels.map((l) => reverseMap[l] || l));
                    }}
                  />
                ),
                cell: (log) => (
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {formatLabel(log.action)}
                  </span>
                ),
              },
              {
                key: 'resource',
                headerClassName:
                  'text-xs uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1',
                header: (
                  <ColumnFilter
                    label="Resource"
                    options={filterOptions.resource}
                    selected={selectedResources}
                    onChange={setSelectedResources}
                  />
                ),
                cell: (log) => (
                  <span
                    className="text-sm truncate text-muted-foreground block min-w-0"
                    title={log.resourceId ? `${log.resource}: ${log.resourceId}` : log.resource}
                  >
                    {log.resource}
                    {log.resourceId ? `: ${log.resourceId.slice(0, 8)}…` : ''}
                  </span>
                ),
              },
              {
                key: 'status',
                headerClassName:
                  'text-xs uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1',
                header: (
                  <ColumnFilter
                    label="Status"
                    options={filterOptions.status}
                    selected={selectedStatuses}
                    onChange={setSelectedStatuses}
                  />
                ),
                cell: (log) => (
                  <span>
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                        log.status === 'success' ? 'bg-signal-green' : 'bg-signal-red'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-xs text-muted-foreground">{log.status}</span>
                    <span className="sr-only">
                      {log.status === 'success' ? 'Success' : 'Failure'}
                    </span>
                  </span>
                ),
              },
              {
                key: 'ip',
                headerClassName: 'text-xs uppercase tracking-[0.15em] text-muted-foreground',
                header: 'IP',
                cell: (log) => (
                  <span className="text-xs tabular-nums text-muted-foreground truncate">
                    {log.ipAddress || '—'}
                  </span>
                ),
              },
            ] satisfies DataTableColumn<AuditEntry>[]
          }
        />
      )}

      <Pagination page={page} totalCount={totalCount} pageSize={pageSize} onPageChange={setPage} />
    </div>
  );
}
