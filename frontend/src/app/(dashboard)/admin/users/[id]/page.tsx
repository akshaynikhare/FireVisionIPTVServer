'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Copy, Check, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import ConfirmDialog from '@/components/ui/confirm-dialog';

interface UserDetail {
  _id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  channelListCode?: string;
  lastLogin?: string;
  createdAt?: string;
  channels?: Array<{
    _id: string;
    channelName: string;
    channelGroup?: string;
    channelUrl?: string;
    channelImg?: string;
    tvgLogo?: string;
    order?: number;
    channelId?: string;
  }>;
}

export default function UserDetailPage() {
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await api.get(`/users/${params.id}`);
        const data = res.data.data || res.data.user || res.data;
        setUser(data);
        setEditUsername(data.username);
        setEditEmail(data.email);
        setEditRole(data.role);
      } catch {
        setError('Failed to load user');
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [params.id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError('');
    setSaveLoading(true);
    try {
      const res = await api.put(`/users/${params.id}`, {
        username: editUsername,
        email: editEmail,
        role: editRole,
      });
      const updated = res.data.data || res.data.user || res.data;
      setUser((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditing(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setSaveError(axiosErr.response?.data?.error || 'Failed to update user');
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleRegenerateCode() {
    try {
      const res = await api.put(`/users/${params.id}/regenerate-code`);
      const newCode = res.data.channelListCode || res.data.data?.channelListCode;
      if (newCode) {
        setUser((prev) => (prev ? { ...prev, channelListCode: newCode } : prev));
      }
    } catch {
      toast('Failed to regenerate code', 'error');
    } finally {
      setShowRegenerateConfirm(false);
    }
  }

  function handleCopyCode() {
    if (!user?.channelListCode) return;
    navigator.clipboard.writeText(user.channelListCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error || 'User not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/users')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div>
          <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">
            {user.username}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
        </div>
      </div>

      {/* User Info */}
      <div className="border border-border">
        <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
            User Details
          </h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs uppercase tracking-[0.1em] text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="p-4 space-y-4">
            {saveError && (
              <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveError}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-username"
                  className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
                >
                  Username
                </label>
                <input
                  id="edit-username"
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-email"
                  className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
                >
                  Email
                </label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-role"
                  className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
                >
                  Role
                </label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <option value="User">User</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saveLoading}
                className="px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saveLoading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setSaveError('');
                  setEditUsername(user.username);
                  setEditEmail(user.email);
                  setEditRole(user.role);
                }}
                className="px-6 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <dl className="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted-foreground">Username</dt>
              <dd className="text-sm font-medium">{user.username}</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="text-sm font-medium">{user.email}</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted-foreground">Role</dt>
              <dd className="text-sm font-medium">{user.role}</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd className="flex items-center gap-2">
                <div className="relative inline-flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-signal-green' : 'bg-signal-red'}`}
                  />
                  <span className="text-sm font-medium">
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await api.put(`/users/${params.id}`, { isActive: !user.isActive });
                      setUser((prev) => (prev ? { ...prev, isActive: !prev.isActive } : prev));
                    } catch {
                      toast('Failed to update status', 'error');
                    }
                  }}
                  className="text-xs uppercase tracking-[0.1em] text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  {user.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </dd>
            </div>
            {user.lastLogin && (
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-sm text-muted-foreground">Last Login</dt>
                <dd className="text-sm font-medium">{new Date(user.lastLogin).toLocaleString()}</dd>
              </div>
            )}
            {user.createdAt && (
              <div className="flex items-center justify-between px-4 py-3">
                <dt className="text-sm text-muted-foreground">Created</dt>
                <dd className="text-sm font-medium">{new Date(user.createdAt).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {/* Channel List Code */}
      <div className="border border-border">
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Channel List Code
          </h2>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <code className="text-lg font-mono font-bold bg-muted px-3 py-1.5 tracking-widest">
              {user.channelListCode || '—'}
            </code>
            {user.channelListCode && (
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Copy to clipboard"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-4 w-4 text-signal-green" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => setShowRegenerateConfirm(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors ml-2"
            >
              <RefreshCw className="h-4 w-4" /> Regenerate
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            This code is used by the TV app to load this user&apos;s channel list.
          </p>
        </div>
      </div>

      {/* Assigned Channels */}
      {user.channels && user.channels.length > 0 && (() => {
        const channels = user.channels!;
        const groupCounts = channels.reduce<Record<string, number>>((acc, ch) => {
          const g = ch.channelGroup || 'Uncategorized';
          acc[g] = (acc[g] || 0) + 1;
          return acc;
        }, {});
        const groupEntries = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]);

        return (
          <div className="border border-border">
            <div className="px-4 py-2 bg-muted/50 border-b border-border">
              <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
                Assigned Channels
              </h2>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border border-b border-border">
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-[0.1em]">Total</p>
                <p className="text-2xl font-bold mt-0.5">{channels.length}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-[0.1em]">Groups</p>
                <p className="text-2xl font-bold mt-0.5">{groupEntries.length}</p>
              </div>
              <div className="px-4 py-3 col-span-2 sm:col-span-2">
                <p className="text-xs text-muted-foreground uppercase tracking-[0.1em] mb-1.5">By Group</p>
                <div className="flex flex-wrap gap-1.5">
                  {groupEntries.slice(0, 8).map(([group, count]) => (
                    <span key={group} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 border border-border">
                      <span className="font-medium">{group}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </span>
                  ))}
                  {groupEntries.length > 8 && (
                    <span className="text-xs text-muted-foreground px-1">+{groupEntries.length - 8} more</span>
                  )}
                </div>
              </div>
            </div>

            {/* Channel table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground w-10">#</th>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Channel</th>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground hidden sm:table-cell">Group</th>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground hidden md:table-cell">Stream URL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {channels.map((ch, idx) => {
                    const logo = ch.tvgLogo || ch.channelImg || null;
                    return (
                      <tr key={ch._id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 text-muted-foreground text-xs tabular-nums">
                          {ch.order != null ? ch.order : idx + 1}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {logo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={logo} alt="" className="w-6 h-6 object-contain flex-shrink-0 bg-muted" />
                            ) : (
                              <div className="w-6 h-6 bg-muted/60 flex-shrink-0 border border-border" />
                            )}
                            <span className="font-medium">{ch.channelName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">
                          <span className="text-xs bg-muted px-1.5 py-0.5 border border-border text-muted-foreground">
                            {ch.channelGroup || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          {ch.channelUrl ? (
                            <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px] block">
                              {ch.channelUrl}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      <ConfirmDialog
        open={showRegenerateConfirm}
        onCancel={() => setShowRegenerateConfirm(false)}
        onConfirm={handleRegenerateCode}
        title="Regenerate Code"
        message="Regenerate channel list code? The old code will stop working."
        confirmLabel="Regenerate"
        variant="destructive"
      />
    </div>
  );
}
