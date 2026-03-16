'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Search,
  Trash2,
  Shield,
  User,
  UserPlus,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import api from '@/lib/api';
import Pagination from '@/components/ui/pagination';
import Modal from '@/components/ui/modal';

interface UserData {
  _id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt?: string;
  channelListCode?: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Add user form state
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('User');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  async function fetchUsers() {
    try {
      const res = await api.get('/users');
      const body = res.data;
      setUsers(Array.isArray(body) ? body : body.data || body.users || []);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleDelete(e: React.MouseEvent, id: string, username: string) {
    e.stopPropagation();
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${id}`);
      setUsers((prev) => prev.filter((u) => u._id !== id));
    } catch {
      alert('Failed to delete user');
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);
    try {
      await api.post('/users', {
        username: newUsername,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      setShowAddForm(false);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      fetchUsers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setAddError(axiosErr.response?.data?.error || 'Failed to create user');
    } finally {
      setAddLoading(false);
    }
  }

  function handleCopyCode(e: React.MouseEvent, code: string) {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  }

  async function handleToggleActive(e: React.MouseEvent, user: UserData) {
    e.stopPropagation();
    try {
      await api.put(`/users/${user._id}`, { isActive: !user.isActive });
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, isActive: !user.isActive } : u)),
      );
    } catch {
      alert('Failed to update user status');
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPage(1);
  }, [search]);

  const filtered = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.channelListCode?.toLowerCase().includes(search.toLowerCase()),
  );
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} registered users</p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(true);
            setAddError('');
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 active:bg-primary/80"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Add User
        </button>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="relative animate-fade-up" style={{ animationDelay: '50ms' }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by username, email, or channel code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 border border-border bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div
        className="border border-border divide-y divide-border animate-fade-up"
        style={{ animationDelay: '100ms' }}
      >
        <div className="hidden lg:grid grid-cols-[1fr,1fr,120px,80px,80px,80px] gap-4 px-4 py-2 bg-muted/50">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Username
          </span>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Email
          </span>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Channel Code
          </span>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Role
          </span>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Status
          </span>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium text-right">
            Actions
          </span>
        </div>
        {paginated.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {search ? 'No users match your search' : 'No users yet'}
          </div>
        ) : (
          paginated.map((user) => (
            <div
              key={user._id}
              onClick={() => router.push(`/admin/users/${user._id}`)}
              className="grid lg:grid-cols-[1fr,1fr,120px,80px,80px,80px] gap-2 lg:gap-4 items-center px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {user.role === 'Admin' ? (
                  <Shield className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{user.username}</span>
              </div>
              <span className="text-sm text-muted-foreground truncate">{user.email}</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <code className="text-xs font-mono bg-muted px-1.5 py-0.5 truncate">
                  {user.channelListCode || '—'}
                </code>
                {user.channelListCode && (
                  <button
                    onClick={(e) => handleCopyCode(e, user.channelListCode!)}
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Copy channel code"
                  >
                    {copiedCode === user.channelListCode ? (
                      <Check className="h-3 w-3 text-signal-green" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                )}
              </div>
              <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                {user.role}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-signal-green' : 'bg-signal-red'}`}
                />
                <span className="text-[11px] text-muted-foreground">
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={(e) => handleToggleActive(e, user)}
                  className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={user.isActive ? 'Deactivate user' : 'Activate user'}
                >
                  {user.isActive ? (
                    <ToggleRight className="h-4 w-4 text-signal-green" />
                  ) : (
                    <ToggleLeft className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={(e) => handleDelete(e, user._id, user.username)}
                  className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Delete ${user.username}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={filtered.length}
        onPageChange={setPage}
      />

      {/* Add User Modal */}
      <Modal
        open={showAddForm}
        onClose={() => {
          setShowAddForm(false);
          setAddError('');
        }}
        title="Create New User"
      >
        <form onSubmit={handleAddUser} className="p-5 space-y-4">
          {addError && (
            <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {addError}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="new-username"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
              >
                Username
              </label>
              <input
                id="new-username"
                type="text"
                required
                minLength={3}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="username"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="new-email"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
              >
                Email
              </label>
              <input
                id="new-email"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="new-password"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
              >
                Password
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Min. 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="new-role"
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground"
              >
                Role
              </label>
              <select
                id="new-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="flex h-10 w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="User">User</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={addLoading}
              className="inline-flex items-center px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
            >
              {addLoading ? 'Creating...' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAddError('');
              }}
              className="px-6 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
