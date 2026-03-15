'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface ServerInfo {
  name: string;
  version: string;
  status: string;
  features: Record<string, boolean>;
}

export default function SettingsPage() {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInfo() {
      try {
        const res = await api.get('/config/info');
        setInfo(res.data.data || res.data);
      } catch {
        // info endpoint may not exist
      } finally {
        setLoading(false);
      }
    }
    fetchInfo();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Server configuration and info</p>
      </div>

      {info && (
        <div className="border border-border animate-fade-up" style={{ animationDelay: '50ms' }}>
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Server Info
            </p>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{info.name}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm font-medium">{info.version}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-signal-green" />
                <span className="text-sm font-medium capitalize">{info.status}</span>
              </div>
            </div>
            {info.features && Object.keys(info.features).length > 0 && (
              <div className="px-4 py-3">
                <p className="text-sm text-muted-foreground mb-2">Features</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(info.features).map(([key, enabled]) => (
                    <span
                      key={key}
                      className={`text-[11px] uppercase tracking-[0.1em] px-2 py-1 border border-border ${enabled ? 'bg-muted/50' : 'bg-muted/20 line-through text-muted-foreground/50'}`}
                    >
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border border-border animate-fade-up" style={{ animationDelay: '100ms' }}>
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
            Session Management
          </p>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Remove all expired sessions from the database.
          </p>
          <button
            onClick={async () => {
              try {
                const res = await api.post('/auth/cleanup-sessions');
                alert(res.data.message || 'Sessions cleaned up');
              } catch {
                alert('Failed to clean up sessions');
              }
            }}
            className="inline-flex items-center px-4 py-2 text-sm font-medium border-2 border-border bg-card shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:shadow-none active:bg-muted"
          >
            Clean Up Expired Sessions
          </button>
        </div>
      </div>
    </div>
  );
}
