'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Shield,
  LogOut,
  Monitor,
  Upload,
  Trash2,
  UserCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: string;
  channelListCode: string;
  profilePicture?: string;
  isActive: boolean;
  lastLogin?: string;
  channels?: string[];
  metadata?: { lastPairedDevice?: string; deviceModel?: string; pairedAt?: string };
  createdAt?: string;
}

interface SessionInfo {
  id: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  expiresAt: string;
  lastActivity?: string;
  isCurrent: boolean;
}

export default function ProfilePage() {
  const { toast } = useToast();
  const { user: authUser, setUser } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  // Edit profile
  const [editing, setEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile picture
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [picMsg, setPicMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change password
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchSessions();
  }, []);

  async function fetchProfile() {
    try {
      const res = await api.get('/auth/me');
      const data = res.data.user || res.data.data || res.data;
      setProfile(data);
      setEditUsername(data.username);
      setEditEmail(data.email);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function fetchSessions() {
    try {
      const res = await api.get('/auth/sessions');
      const data = res.data.sessions || res.data.data || [];
      setSessions(data);
    } catch {
      // ignore
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveLoading(true);
    setSaveMsg(null);
    try {
      const res = await api.put('/auth/profile', {
        username: editUsername,
        email: editEmail,
      });
      const updated = res.data.user || res.data.data || res.data;
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
      if (authUser) {
        setUser({
          ...authUser,
          username: updated.username || editUsername,
          email: updated.email || editEmail,
        });
      }
      setSaveMsg({ type: 'success', text: 'Profile updated successfully' });
      setEditing(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setSaveMsg({
        type: 'error',
        text: axiosErr.response?.data?.error || 'Failed to update profile',
      });
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwLoading(true);
    setPwMsg(null);
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setPwMsg({ type: 'success', text: res.data.message || 'Password changed successfully' });
      setCurrentPw('');
      setNewPw('');
      setShowPwForm(false);
      fetchSessions();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setPwMsg({
        type: 'error',
        text: axiosErr.response?.data?.error || 'Failed to change password',
      });
    } finally {
      setPwLoading(false);
    }
  }

  async function handleRegenerateCode() {
    if (
      !confirm(
        'Regenerate your channel list code? The old code will stop working on all paired devices.',
      )
    )
      return;
    try {
      const res = await api.post('/auth/regenerate-channel-code');
      const newCode = res.data.channelListCode || res.data.data?.channelListCode;
      if (newCode) {
        setProfile((prev) => (prev ? { ...prev, channelListCode: newCode } : prev));
        if (authUser) {
          setUser({ ...authUser, channelListCode: newCode });
        }
      }
    } catch {
      toast('Failed to regenerate code', 'error');
    }
  }

  async function handleRevokeSession(sessionId: string) {
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    } catch {
      toast('Failed to revoke session', 'error');
    }
  }

  async function handleUploadPicture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPic(true);
    setPicMsg(null);
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);
      const res = await api.post('/auth/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const picUrl = res.data.profilePicture || res.data.data?.profilePicture;
      if (picUrl) {
        setProfile((prev) => (prev ? { ...prev, profilePicture: picUrl } : prev));
      }
      setPicMsg({ type: 'success', text: 'Profile picture updated' });
    } catch {
      setPicMsg({ type: 'error', text: 'Failed to upload picture' });
    } finally {
      setUploadingPic(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeletePicture() {
    if (!confirm('Remove your profile picture?')) return;
    try {
      await api.delete('/auth/profile-picture');
      setProfile((prev) => (prev ? { ...prev, profilePicture: undefined } : prev));
      setPicMsg({ type: 'success', text: 'Profile picture removed' });
    } catch {
      setPicMsg({ type: 'error', text: 'Failed to remove picture' });
    }
  }

  function handleCopyCode() {
    if (!profile?.channelListCode) return;
    navigator.clipboard.writeText(profile.channelListCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  }

  function parseBrowser(ua?: string): string {
    if (!ua) return 'Unknown';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    return 'Browser';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div
        role="alert"
        className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        Failed to load profile
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account and security</p>
      </div>

      {/* Profile Picture */}
      <div className="border border-border">
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Profile Picture
          </h2>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            {profile.profilePicture ? (
              /* eslint-disable-next-line @next/next/no-img-element -- dynamic external URL with proxy fallback */
              <img
                src={
                  profile.profilePicture.startsWith('/')
                    ? `/api/v1${profile.profilePicture}`
                    : profile.profilePicture
                }
                alt="Profile"
                loading="lazy"
                className="h-16 w-16 rounded-full object-cover border-2 border-border"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                <UserCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={handleUploadPicture}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPic}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors disabled:opacity-50"
                aria-label="Upload profile picture"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploadingPic ? 'Uploading...' : 'Upload'}
              </button>
              {profile.profilePicture && (
                <button
                  onClick={handleDeletePicture}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-destructive hover:border-destructive/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">JPEG, PNG, or GIF. Max 5 MB.</p>
          {picMsg && (
            <div
              role="alert"
              aria-live="polite"
              className={`mt-3 px-4 py-2.5 text-sm border ${picMsg.type === 'success' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}
            >
              {picMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* Profile Info */}
      <div className="border border-border">
        <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Account Details
          </h2>
          {!editing && (
            <button
              onClick={() => {
                setEditing(true);
                setSaveMsg(null);
              }}
              className="text-xs uppercase tracking-[0.1em] text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSaveProfile} className="p-4 space-y-4">
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
                  setSaveMsg(null);
                  setEditUsername(profile.username);
                  setEditEmail(profile.email);
                }}
                className="px-6 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Username</span>
              <span className="text-sm font-medium">{profile.username}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{profile.email}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Role</span>
              <div className="relative inline-flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-medium">{profile.role}</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="relative inline-flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${profile.isActive ? 'bg-signal-green' : 'bg-signal-red'}`}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">
                  {profile.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="sr-only">
                  {profile.isActive ? 'Account is active' : 'Account is inactive'}
                </span>
              </div>
            </div>
            {profile.createdAt && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="text-sm font-medium">
                  {new Date(profile.createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        )}

        {saveMsg && (
          <div
            role="alert"
            aria-live="polite"
            className={`mx-4 mb-4 px-4 py-3 text-sm border ${saveMsg.type === 'success' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}
          >
            {saveMsg.text}
          </div>
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
              {profile.channelListCode || '------'}
            </code>
            {profile.channelListCode && (
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
            This code is used by the TV app to load your channel list.
          </p>
        </div>
      </div>

      {/* Change Password */}
      <div className="border border-border">
        <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Password
          </h2>
          {!showPwForm && (
            <button
              onClick={() => {
                setShowPwForm(true);
                setPwMsg(null);
              }}
              className="text-xs uppercase tracking-[0.1em] text-primary hover:text-primary/80 transition-colors font-medium"
            >
              Change
            </button>
          )}
        </div>
        {showPwForm ? (
          <form onSubmit={handleChangePassword} className="p-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="current-pw"
                  className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
                >
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="current-pw"
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className="flex h-10 w-full border border-border bg-background px-3 py-2 pr-10 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="new-pw"
                  className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-pw"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="flex h-10 w-full border border-border bg-background px-3 py-2 pr-10 text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pwLoading}
                className="px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {pwLoading ? 'Updating...' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPwForm(false);
                  setPwMsg(null);
                  setCurrentPw('');
                  setNewPw('');
                }}
                className="px-6 py-2.5 text-sm font-medium border border-border uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="px-4 py-4">
            <p className="text-sm text-muted-foreground">
              Password is set. Click &quot;Change&quot; to update it.
            </p>
          </div>
        )}
        {pwMsg && (
          <div
            role="alert"
            aria-live="polite"
            className={`mx-4 mb-4 px-4 py-3 text-sm border ${pwMsg.type === 'success' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-destructive/40 bg-destructive/10 text-destructive'}`}
          >
            {pwMsg.text}
          </div>
        )}
      </div>

      {/* Active Sessions */}
      {sessions.length > 0 && (
        <div className="border border-border">
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Active Sessions ({sessions.length})
            </h2>
          </div>
          <div className="divide-y divide-border">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{parseBrowser(s.userAgent)}</p>
                    {s.isCurrent && (
                      <span className="text-xs uppercase tracking-[0.1em] bg-primary/10 text-primary px-1.5 py-0.5 font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.ipAddress || 'Unknown IP'} &middot; {new Date(s.createdAt).toLocaleString()}
                  </p>
                </div>
                {!s.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(s.sessionId)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    aria-label="Revoke session"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
