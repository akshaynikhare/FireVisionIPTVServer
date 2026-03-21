// Re-export types from shared package when available
// For now, define minimal types needed by the frontend

export interface User {
  _id: string;
  username: string;
  email: string;
  role: 'Admin' | 'User';
  isActive: boolean;
  channelListCode: string;
  emailVerified?: boolean;
  profilePicture?: string | null;
  lastLogin?: string;
  channels?: string[];
  metadata?: {
    deviceName?: string;
    deviceModel?: string;
    lastPairedDevice?: string;
    pairedAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface FlaggedBad {
  isFlagged: boolean;
  reason?: string | null;
  flaggedBy?: string | null;
  flaggedAt?: string | null;
}

export interface AlternateStreamLiveness {
  status: 'alive' | 'dead' | 'unknown';
  lastCheckedAt?: string | null;
  responseTimeMs?: number | null;
  error?: string | null;
}

export interface AlternateStream {
  streamUrl: string;
  quality?: string | null;
  liveness: AlternateStreamLiveness;
  flaggedBad: FlaggedBad;
  userAgent?: string | null;
  referrer?: string | null;
  source?: string | null;
  promotedAt?: string | null;
  demotedAt?: string | null;
}

export interface Channel {
  _id: string;
  channelId?: string;
  channelName?: string;
  name?: string;
  channelUrl?: string;
  url?: string;
  streamUrl?: string;
  channelImg?: string;
  tvgLogo?: string;
  tvgName?: string;
  logo?: string;
  logoUrl?: string;
  channelGroup?: string;
  category?: string;
  channelDrmKey?: string;
  channelDrmType?: string;
  order?: number;
  epgId?: string;
  isActive?: boolean;
  channelNumber?: number;
  metadata?: {
    isWorking?: boolean;
    lastTested?: string;
    responseTime?: number;
    country?: string;
    language?: string;
    resolution?: string;
    tags?: string[];
  };
  flaggedBad?: FlaggedBad;
  alternateStreams?: AlternateStream[];
  metrics?: {
    deadCount?: number;
    aliveCount?: number;
    unresponsiveCount?: number;
    playCount?: number;
    proxyPlayCount?: number;
    lastDeadAt?: string;
    lastAliveAt?: string;
    lastPlayedAt?: string;
    lastUnresponsiveAt?: string;
  };
}

export interface AppVersion {
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

export interface TestResult {
  channelId: string;
  channelName?: string;
  working: boolean;
  statusCode?: number;
  responseTime?: number;
  contentType?: string;
  manifestValid?: boolean;
  manifestInfo?: {
    isLive?: boolean;
    hasVideo?: boolean;
    segmentCount?: number;
  };
  message?: string;
  error?: string;
}
