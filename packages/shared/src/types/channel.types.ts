import { Types, Document } from 'mongoose';

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
