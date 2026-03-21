import { Types, Document } from 'mongoose';

export interface IFlaggedBad {
  isFlagged: boolean;
  reason?: string | null;
  flaggedBy?: Types.ObjectId | null;
  flaggedAt?: Date | null;
}

export interface IAlternateStreamLiveness {
  status: 'alive' | 'dead' | 'unknown';
  lastCheckedAt?: Date | null;
  responseTimeMs?: number | null;
  error?: string | null;
}

export interface IAlternateStream {
  streamUrl: string;
  quality?: string | null;
  liveness: IAlternateStreamLiveness;
  flaggedBad: IFlaggedBad;
  userAgent?: string | null;
  referrer?: string | null;
  source?: string | null;
  promotedAt?: Date | null;
  demotedAt?: Date | null;
}

export interface IChannel {
  channelId: string;
  channelName: string;
  channelUrl: string;
  channelImg: string;
  channelGroup: string;
  channelDrmKey: string;
  channelDrmType: string;
  tvgId: string;
  tvgName: string;
  tvgLogo: string;
  order: number;
  metadata?: {
    country?: string;
    language?: string;
    resolution?: string;
    network?: string;
    website?: string;
    quality?: string;
    tags?: string[];
    lastTested?: Date;
    isWorking?: boolean;
    responseTime?: number;
  };
  flaggedBad?: IFlaggedBad;
  alternateStreams?: IAlternateStream[];
  metrics?: {
    deadCount?: number;
    aliveCount?: number;
    unresponsiveCount?: number;
    playCount?: number;
    proxyPlayCount?: number;
    lastDeadAt?: Date;
    lastAliveAt?: Date;
    lastPlayedAt?: Date;
    lastUnresponsiveAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IChannelDocument extends IChannel, Document {
  _id: Types.ObjectId;
  toM3U(): string;
}

export interface IChannelModel {
  generateM3UPlaylist(): Promise<string>;
}
