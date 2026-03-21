import { Types, Document } from 'mongoose';

export type ExternalSourceType = 'pluto-tv' | 'samsung-tv-plus' | 'youtube-live' | 'prasar-bharati';

export type SeedSourceType = 'youtube-live' | 'prasar-bharati';

export interface IExternalSourceCacheMeta {
  cacheKey: string;
  source: ExternalSourceType;
  region: string;
  lastRefreshedAt: Date;
  refreshInProgress: boolean;
  livenessCheckInProgress: boolean;
  lastLivenessCheckAt: Date | null;
  channelCount: number;
  refreshDurationMs: number;
  livenessStats: {
    alive: number;
    dead: number;
    unknown: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IExternalSourceCacheMetaDocument extends IExternalSourceCacheMeta, Document {
  _id: Types.ObjectId;
}

export interface IExternalSourceChannelLiveness {
  status: 'alive' | 'dead' | 'unknown';
  lastCheckedAt: Date | null;
  responseTimeMs: number | null;
  statusCode: number | null;
  error: string | null;
  manifestValid: boolean | null;
  segmentReachable: boolean | null;
  manifestInfo: {
    isLive: boolean;
    hasVideo: boolean;
    segmentCount: number;
  } | null;
}

export interface IExternalSourceChannel {
  source: ExternalSourceType;
  region: string;
  channelId: string;
  channelName: string;
  streamUrl: string;
  streamUrlExpiresAt: Date | null;
  tvgLogo: string | null;
  groupTitle: string;
  country: string | null;
  summary: string | null;
  codec: string | null;
  bitrate: number | null;
  language: string | null;
  votes: number | null;
  homepage: string | null;
  liveness: IExternalSourceChannelLiveness;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISeedChannel {
  ytChannelId?: string;
  directUrl?: string;
  channelName: string;
  tvgLogo: string;
  groupTitle: string;
  language: string;
  enabled: boolean;
  source: SeedSourceType;
}

export interface ISeedChannelDocument extends ISeedChannel, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IExternalSourceChannelDocument extends IExternalSourceChannel, Document {
  _id: Types.ObjectId;
}
