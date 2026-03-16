// Re-export types from shared package when available
// For now, define minimal types needed by the frontend

export interface User {
  _id: string;
  username: string;
  email: string;
  role: 'Admin' | 'User';
  isActive: boolean;
  channelListCode: string;
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
