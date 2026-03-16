'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Search } from 'lucide-react';
import api from '@/lib/api';
import Pagination from '@/components/ui/pagination';
import ColumnFilter from '@/components/ui/column-filter';

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
  const [search, setSearch] = useState('');
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

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search) params.set('search', search);
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

      const res = await api.get(`/activity?${params.toString()}`);
      const data = res.data?.data || res.data;
      setLogs(data.logs || []);
      setTotalCount(data.totalCount || 0);
    } catch {
      setError('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedActions, selectedResources, selectedStatuses, filterOptions]);

  useEffect(() => {
    api
      .get('/activity/filter-options')
      .then((res) => {
        setFilterOptions(res.data?.data || { action: [], resource: [], status: [] });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedActions, selectedResources, selectedStatuses]);

  return (
    <div className="space-y-6">
      <div className="">
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Activity Log</h1>
        <h2 className="text-sm text-muted-foreground mt-1">
          System-wide audit trail of all actions
        </h2>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div role="table" aria-label="Activity log table" className="border border-border ">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search activity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            aria-label="Search activity logs"
          />
        </div>

        {/* Table Header */}
        <div
          role="rowgroup"
          className="hidden lg:grid grid-cols-[100px,140px,120px,1fr,80px,120px] gap-4 px-4 py-2 bg-muted/50 border-b border-border"
        >
          <span
            role="columnheader"
            className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground"
          >
            Time
          </span>
          <span
            role="columnheader"
            className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground"
          >
            User
          </span>
          <span
            role="columnheader"
            className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1"
          >
            Action
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
          </span>
          <span
            role="columnheader"
            className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1"
          >
            Resource
            <ColumnFilter
              label="Resource"
              options={filterOptions.resource}
              selected={selectedResources}
              onChange={setSelectedResources}
            />
          </span>
          <span
            role="columnheader"
            className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1"
          >
            Status
            <ColumnFilter
              label="Status"
              options={filterOptions.status}
              selected={selectedStatuses}
              onChange={setSelectedStatuses}
            />
          </span>
          <span
            role="columnheader"
            className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground"
          >
            IP
          </span>
        </div>

        {/* Rows */}
        <div role="rowgroup" className="divide-y divide-border">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No activity logs found
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log._id}
                role="row"
                className="grid lg:grid-cols-[100px,140px,120px,1fr,80px,120px] gap-2 lg:gap-4 items-center px-4 py-3"
              >
                <div role="cell" className="text-[11px] tabular-nums text-muted-foreground">
                  <time dateTime={log.timestamp}>
                    <span className="font-medium">{formatTime(log.timestamp)}</span>
                  </time>
                  <time dateTime={log.timestamp} className="ml-1.5 text-muted-foreground/60">
                    {formatDate(log.timestamp)}
                  </time>
                </div>
                <span role="cell" className="text-sm truncate">
                  {log.userId?.username || '—'}
                </span>
                <span
                  role="cell"
                  className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {formatLabel(log.action)}
                </span>
                <span role="cell" className="text-sm truncate text-muted-foreground">
                  {log.resource}
                  {log.resourceId ? `: ${log.resourceId}` : ''}
                </span>
                <span role="cell">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                      log.status === 'success' ? 'bg-signal-green' : 'bg-signal-red'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] text-muted-foreground">{log.status}</span>
                  <span className="sr-only">
                    {log.status === 'success' ? 'Success' : 'Failure'}
                  </span>
                </span>
                <span
                  role="cell"
                  className="text-[11px] tabular-nums text-muted-foreground truncate"
                >
                  {log.ipAddress || '—'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <Pagination page={page} totalCount={totalCount} pageSize={pageSize} onPageChange={setPage} />
    </div>
  );
}
