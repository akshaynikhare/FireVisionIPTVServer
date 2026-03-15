'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Copy, Check, RefreshCw } from 'lucide-react';
import api from '@/lib/api';

interface UserDetail {
  _id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  channelListCode?: string;
  lastLogin?: string;
  createdAt?: string;
  channels?: Array<{ _id: string; name: string; channelGroup?: string }>;
}

export default function UserDetailPage() {
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
    if (!confirm('Regenerate channel list code? The old code will stop working.')) return;
    try {
      const res = await api.put(`/users/${params.id}/regenerate-code`);
      const newCode = res.data.channelListCode || res.data.data?.channelListCode;
      if (newCode) {
        setUser((prev) => (prev ? { ...prev, channelListCode: newCode } : prev));
      }
    } catch {
      alert('Failed to regenerate code');
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
      <div className="flex items-center gap-4 animate-fade-up">
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
      <div className="border border-border animate-fade-up" style={{ animationDelay: '50ms' }}>
        <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            User Details
          </p>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-[11px] uppercase tracking-[0.1em] text-primary hover:text-primary/80 transition-colors font-medium"
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
                  className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
                >
                  Username
                </label>
                <input
                  id="edit-username"
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-email"
                  className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
                >
                  Email
                </label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-role"
                  className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
                >
                  Role
                </label>
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
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
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Username</span>
              <span className="text-sm font-medium">{user.username}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{user.email}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Role</span>
              <span className="text-sm font-medium">{user.role}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-signal-green' : 'bg-signal-red'}`}
                />
                <span className="text-sm font-medium">{user.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            {user.lastLogin && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Last Login</span>
                <span className="text-sm font-medium">
                  {new Date(user.lastLogin).toLocaleString()}
                </span>
              </div>
            )}
            {user.createdAt && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm font-medium">
                  {new Date(user.createdAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Channel List Code */}
      <div className="border border-border animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Channel List Code
          </p>
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
                aria-label="Copy code"
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
              onClick={handleRegenerateCode}
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
      {user.channels && user.channels.length > 0 && (
        <div className="border border-border animate-fade-up" style={{ animationDelay: '150ms' }}>
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Assigned Channels ({user.channels.length})
            </p>
          </div>
          <div className="divide-y divide-border">
            {user.channels.map((ch) => (
              <div key={ch._id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium">{ch.name}</span>
                <span className="text-xs text-muted-foreground">{ch.channelGroup || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
