'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface PairingRequest {
  _id: string;
  pin?: string;
  deviceName?: string;
  deviceModel?: string;
  status: string;
  userId?: { username?: string };
  createdAt: string;
  expiresAt?: string;
}

export default function DevicesPage() {
  const [stats, setStats] = useState<{
    total: number;
    pending: number;
    completed: number;
    today: number;
    recent: PairingRequest[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/admin/stats/detailed');
        const data = res.data;
        setStats({
          total: data.pairings?.total ?? 0,
          pending: data.pairings?.pending ?? 0,
          completed: data.pairings?.completed ?? 0,
          today: data.pairings?.today ?? 0,
          recent: data.pairings?.recent || [],
        });
      } catch {
        setError('Failed to load device data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">Devices</h1>
        <p className="text-sm text-muted-foreground mt-1">Paired devices and pairing requests</p>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {stats && (
        <>
          <div
            className="grid grid-cols-2 lg:grid-cols-4 border border-border animate-fade-up"
            style={{ animationDelay: '50ms' }}
          >
            {[
              { label: 'Total', value: stats.total },
              { label: 'Completed', value: stats.completed },
              { label: 'Pending', value: stats.pending },
              { label: 'Today', value: stats.today },
            ].map((m, i) => (
              <div key={m.label} className={`p-4 ${i > 0 ? 'border-l border-border' : ''}`}>
                <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  {m.label}
                </p>
                <p className="text-2xl font-display font-bold mt-1.5 tabular-nums">{m.value}</p>
              </div>
            ))}
          </div>

          <div className="animate-fade-up" style={{ animationDelay: '100ms' }}>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
              Recent Pairing Requests
            </p>
            <div className="border border-border divide-y divide-border">
              {stats.recent.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No pairing requests yet
                </div>
              ) : (
                stats.recent.map((req) => (
                  <div key={req._id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {req.deviceName || 'Unknown Device'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.deviceModel || 'Unknown Model'}
                        {req.userId?.username && ` — ${req.userId.username}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-4">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          req.status === 'completed'
                            ? 'bg-signal-green'
                            : req.status === 'pending'
                              ? 'bg-primary'
                              : 'bg-signal-red'
                        }`}
                      />
                      <span className="text-[11px] text-muted-foreground capitalize">
                        {req.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
