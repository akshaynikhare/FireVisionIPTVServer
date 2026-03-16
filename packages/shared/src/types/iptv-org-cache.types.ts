import { Types, Document } from 'mongoose';

export interface IIptvOrgCacheMeta {
  cacheKey: string;
  lastRefreshedAt: Date;
  refreshInProgress: boolean;
  livenessCheckInProgress: boolean;
  lastLivenessCheckAt: Date | null;
  sourceCounts: {
    channels: number;
    streams: number;
    languages: number;
    guides: number;
    feeds: number;
    logos: number;
  };
  enrichedCount: number;
  refreshDurationMs: number;
  livenessStats: {
    alive: number;
    dead: number;
    unknown: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IIptvOrgCacheMetaDocument extends IIptvOrgCacheMeta, Document {
  _id: Types.ObjectId;
}

export interface IIptvOrgChannelLiveness {
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

export interface IIptvOrgChannel {
  channelId: string;
  channelName: string;
  streamUrl: string;
  streamQuality: string | null;
  streamUserAgent: string | null;
  streamReferrer: string | null;
  tvgLogo: string | null;
  country: string | null;
  categories: string[];
  languageCodes: string[];
  languageNames: string[];
  channelNetwork: string | null;
  channelWebsite: string | null;
  channelIsNsfw: boolean;
  channelGroup: string;
  liveness: IIptvOrgChannelLiveness;
  createdAt: Date;
  updatedAt: Date;
}

export interface IIptvOrgChannelDocument extends IIptvOrgChannel, Document {
  _id: Types.ObjectId;
}
