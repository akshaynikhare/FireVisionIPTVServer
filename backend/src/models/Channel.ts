import mongoose, { Schema, Model } from 'mongoose';
import { IAlternateStream, IChannelDocument, IChannelModel } from '@firevision/shared';

const channelSchema = new Schema<IChannelDocument>(
  {
    // Ownership: null = shared admin catalog (browsable, servable to the demo);
    // a user id = a private channel from that user's import (never shown to admins).
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    channelId: {
      type: String,
      required: true,
      // Uniqueness is per-owner via a compound index (see below), not global.
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
      // Covered by the compound { channelGroup: 1, order: 1 } index below — no standalone index.
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
    alternateStreams: {
      type: [
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
      validate: [
        {
          validator: (v: unknown[]) => !v || v.length <= 50,
          message: 'A channel can have at most 50 alternate streams',
        },
      ],
    },
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
// channelId is unique PER OWNER (catalog = ownerId:null), not globally, so different
// users can import the same channelId as their own private channels.
channelSchema.index({ ownerId: 1, channelId: 1 }, { unique: true });

// Build a single M3U #EXTINF entry from a channel-like object.
// Works for both Mongoose docs and lean POJOs so the playlist export can stream lean docs.
function buildM3ULine(ch: {
  channelId?: string;
  tvgName?: string;
  channelName: string;
  tvgLogo?: string;
  channelImg?: string;
  channelGroup?: string;
  channelUrl: string;
}): string {
  // Escape double quotes in interpolated values to prevent M3U attribute injection
  const esc = (s: string | undefined) => (s ?? '').replace(/"/g, "'");

  let m3uLine = `#EXTINF:-1`;

  if (ch.channelId) m3uLine += ` tvg-id="${esc(ch.channelId)}"`;
  if (ch.tvgName || ch.channelName) m3uLine += ` tvg-name="${esc(ch.tvgName || ch.channelName)}"`;
  if (ch.tvgLogo || ch.channelImg) m3uLine += ` tvg-logo="${esc(ch.tvgLogo || ch.channelImg)}"`;
  if (ch.channelGroup) m3uLine += ` group-title="${esc(ch.channelGroup)}"`;

  m3uLine += `,${ch.channelName}\n${ch.channelUrl}`;

  return m3uLine;
}

// Method to convert to M3U format entry
channelSchema.methods.toM3U = function (this: IChannelDocument): string {
  return buildM3ULine(this);
};

// Static method to generate full M3U playlist.
// Streams via a lean cursor + field projection so we never hydrate tens of thousands
// of full Mongoose documents into memory at once.
channelSchema.statics.generateM3UPlaylist = async function (): Promise<string> {
  const cursor = this.find({ ownerId: null })
    .select(
      'channelId channelName channelUrl channelImg tvgLogo tvgName channelGroup ' +
        'metadata.isWorking flaggedBad.isFlagged ' +
        'alternateStreams.streamUrl alternateStreams.liveness.status alternateStreams.flaggedBad.isFlagged',
    )
    .sort({ channelGroup: 1, order: 1 })
    .lean()
    .cursor();

  let m3uContent = '#EXTM3U\n\n';

  for (let channel: any = await cursor.next(); channel != null; channel = await cursor.next()) {
    const primaryDead = channel.metadata?.isWorking === false;
    const primaryFlagged = channel.flaggedBad?.isFlagged === true;

    if ((primaryDead || primaryFlagged) && channel.alternateStreams?.length) {
      const viableAlt = channel.alternateStreams.find(
        (alt: IAlternateStream) =>
          alt.liveness?.status === 'alive' && alt.flaggedBad?.isFlagged !== true,
      );
      if (viableAlt) {
        m3uContent += buildM3ULine({ ...channel, channelUrl: viableAlt.streamUrl }) + '\n\n';
        continue;
      }
    }
    m3uContent += buildM3ULine(channel) + '\n\n';
  }

  return m3uContent;
};

const Channel = mongoose.model<IChannelDocument, Model<IChannelDocument> & IChannelModel>(
  'Channel',
  channelSchema,
);

module.exports = Channel;
export default Channel;
