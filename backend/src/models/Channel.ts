import mongoose, { Schema, Model } from 'mongoose';
import { IAlternateStream, IChannelDocument, IChannelModel } from '@firevision/shared';

const channelSchema = new Schema<IChannelDocument>(
  {
    channelId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    channelName: {
      type: String,
      required: true,
      trim: true,
    },
    channelUrl: {
      type: String,
      required: true,
    },
    channelImg: {
      type: String,
      default: '',
    },
    channelGroup: {
      type: String,
      default: 'Uncategorized',
      index: true,
    },
    channelDrmKey: {
      type: String,
      default: '',
    },
    channelDrmType: {
      type: String,
      default: '',
    },
    tvgId: {
      type: String,
      default: '',
    },
    tvgName: {
      type: String,
      default: '',
    },
    tvgLogo: {
      type: String,
      default: '',
    },
    order: {
      type: Number,
      default: 0,
    },
    metadata: {
      country: String,
      language: String,
      resolution: String,
      network: String,
      website: String,
      quality: String,
      tags: [String],
      lastTested: Date,
      isWorking: Boolean,
      responseTime: Number,
    },
    flaggedBad: {
      isFlagged: { type: Boolean, default: false },
      reason: { type: String, default: null },
      flaggedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      flaggedAt: { type: Date, default: null },
    },
    alternateStreams: [
      {
        streamUrl: { type: String, required: true },
        quality: { type: String, default: null },
        liveness: {
          status: {
            type: String,
            enum: ['alive', 'dead', 'unknown'],
            default: 'unknown',
          },
          lastCheckedAt: { type: Date, default: null },
          responseTimeMs: { type: Number, default: null },
          error: { type: String, default: null },
        },
        flaggedBad: {
          isFlagged: { type: Boolean, default: false },
          reason: { type: String, default: null },
          flaggedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
          flaggedAt: { type: Date, default: null },
        },
        userAgent: { type: String, default: null },
        referrer: { type: String, default: null },
        source: { type: String, default: null },
        promotedAt: { type: Date, default: null },
        demotedAt: { type: Date, default: null },
      },
    ],
    metrics: {
      deadCount: { type: Number, default: 0 },
      aliveCount: { type: Number, default: 0 },
      unresponsiveCount: { type: Number, default: 0 },
      playCount: { type: Number, default: 0 },
      proxyPlayCount: { type: Number, default: 0 },
      lastDeadAt: Date,
      lastAliveAt: Date,
      lastPlayedAt: Date,
      lastUnresponsiveAt: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
channelSchema.index({ channelGroup: 1, order: 1 });
channelSchema.index({ channelName: 'text' });

// Method to convert to M3U format entry
channelSchema.methods.toM3U = function (this: IChannelDocument): string {
  // Escape double quotes in interpolated values to prevent M3U attribute injection
  const esc = (s: string) => s.replace(/"/g, "'");

  let m3uLine = `#EXTINF:-1`;

  if (this.channelId) m3uLine += ` tvg-id="${esc(this.channelId)}"`;
  if (this.tvgName || this.channelName)
    m3uLine += ` tvg-name="${esc(this.tvgName || this.channelName)}"`;
  if (this.tvgLogo || this.channelImg)
    m3uLine += ` tvg-logo="${esc(this.tvgLogo || this.channelImg)}"`;
  if (this.channelGroup) m3uLine += ` group-title="${esc(this.channelGroup)}"`;

  m3uLine += `,${this.channelName}\n${this.channelUrl}`;

  return m3uLine;
};

// Static method to generate full M3U playlist
channelSchema.statics.generateM3UPlaylist = async function (): Promise<string> {
  const channels = await this.find({}).sort({ channelGroup: 1, order: 1 });

  let m3uContent = '#EXTM3U\n\n';

  channels.forEach((channel: IChannelDocument) => {
    const primaryDead = channel.metadata?.isWorking === false;
    const primaryFlagged = channel.flaggedBad?.isFlagged === true;

    if ((primaryDead || primaryFlagged) && channel.alternateStreams?.length) {
      const viableAlt = channel.alternateStreams.find(
        (alt: IAlternateStream) =>
          alt.liveness?.status === 'alive' && alt.flaggedBad?.isFlagged !== true,
      );
      if (viableAlt) {
        const originalUrl = channel.channelUrl;
        channel.channelUrl = viableAlt.streamUrl;
        m3uContent += channel.toM3U() + '\n\n';
        channel.channelUrl = originalUrl;
        return;
      }
    }
    m3uContent += channel.toM3U() + '\n\n';
  });

  return m3uContent;
};

const Channel = mongoose.model<IChannelDocument, Model<IChannelDocument> & IChannelModel>(
  'Channel',
  channelSchema,
);

module.exports = Channel;
export default Channel;
