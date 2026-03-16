'use client';

import { useEffect, useState } from 'react';
import { Loader2, Download, Package, Calendar, FileText, Tag, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface AppVersion {
  _id: string;
  versionName: string;
  versionCode: number;
  apkFileName?: string;
  apkFileSize?: number;
  downloadUrl?: string;
  releaseNotes?: string;
  isActive?: boolean;
  isMandatory?: boolean;
  minCompatibleVersion?: number;
  releasedAt?: string;
}

export default function VersionsPage() {
  const [latest, setLatest] = useState<AppVersion | null>(null);
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [latestRes, versionsRes] = await Promise.allSettled([
          api.get('/app/latest'),
          api.get('/app/versions'),
        ]);

        if (latestRes.status === 'fulfilled') {
          const data = latestRes.value.data;
          setLatest(data.version || data.data || data);
        }

        if (versionsRes.status === 'fulfilled') {
          const data = versionsRes.value.data;
          setVersions(data.versions || data.data || []);
        }

        try {
          const dlRes = await api.get('/app/download-url');
          setDownloadUrl(dlRes.data.downloadUrl || dlRes.data.url || '');
        } catch {
          // download URL may not be configured
        }
      } catch {
        setError('Failed to load version information');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  function formatBytes(bytes?: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-display font-bold uppercase tracking-[0.1em]">App Versions</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage Fire TV application releases</p>
      </div>

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Latest Version Card */}
      {latest && (
        <div className="border-2 border-primary/30 bg-card">
          <div className="px-5 py-3 border-b border-border bg-muted/50 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Latest Release
            </p>
            {latest.isMandatory && (
              <span className="text-xs uppercase tracking-[0.1em] bg-signal-red/10 text-signal-red px-2 py-0.5 font-medium border border-signal-red/20">
                Mandatory Update
              </span>
            )}
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <span className="text-lg font-display font-bold">{latest.versionName}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    (code: {latest.versionCode})
                  </span>
                </div>
                {latest.releasedAt && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(latest.releasedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {latest.isActive !== false && (
                  <span className="flex items-center gap-1.5 text-xs text-signal-green">
                    <span className="w-1.5 h-1.5 rounded-full bg-signal-green" aria-hidden="true" />
                    Active
                  </span>
                )}
              </div>
            </div>

            {latest.releaseNotes && (
              <div className="space-y-1.5">
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  Release Notes
                </p>
                <div className="bg-muted/50 border border-border px-4 py-3 text-sm whitespace-pre-wrap">
                  {latest.releaseNotes}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">File</p>
                <p className="text-sm font-medium mt-0.5 truncate">{latest.apkFileName || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Size</p>
                <p className="text-sm font-medium mt-0.5">{formatBytes(latest.apkFileSize)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  Min Compatible
                </p>
                <p className="text-sm font-medium mt-0.5">{latest.minCompatibleVersion || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Status</p>
                <p className="text-sm font-medium mt-0.5">
                  {latest.isActive !== false ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>

            {(downloadUrl || latest.downloadUrl) && (
              <a
                href={downloadUrl || latest.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Download APK version ${latest.versionName}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground uppercase tracking-[0.1em] transition-colors hover:bg-primary/90"
              >
                <Download className="h-4 w-4" />
                Download APK
              </a>
            )}
          </div>
        </div>
      )}

      {!latest && !error && (
        <div className="border border-border bg-card px-6 py-10 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No app versions found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upload an APK or configure GitHub releases to manage versions
          </p>
        </div>
      )}

      {/* Version History */}
      {versions.length > 1 && (
        <div className="border border-border">
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <h2 className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Version History ({versions.length})
            </h2>
          </div>
          <div className="divide-y divide-border">
            {versions.map((v) => (
              <div key={v._id} className="flex items-center gap-4 px-4 py-3">
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{v.versionName}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      v{v.versionCode}
                    </span>
                    {v.isMandatory && (
                      <span className="text-xs uppercase tracking-[0.1em] bg-signal-red/10 text-signal-red px-1.5 py-0.5 font-medium">
                        Mandatory
                      </span>
                    )}
                    {v.isActive === false && (
                      <span className="text-xs uppercase tracking-[0.1em] bg-muted text-muted-foreground px-1.5 py-0.5">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {v.releasedAt && <span>{new Date(v.releasedAt).toLocaleDateString()}</span>}
                    {v.apkFileSize && <span>{formatBytes(v.apkFileSize)}</span>}
                    {v.releaseNotes && (
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" /> Has notes
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
