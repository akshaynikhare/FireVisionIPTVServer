import mongoose, { Schema } from 'mongoose';
import {
  IExternalSourceCacheMetaDocument,
  IExternalSourceChannelDocument,
} from '@firevision/shared';

// ─── Cache Metadata (one doc per source+region) ────────────
const externalSourceCacheMetaSchema = new Schema<IExternalSourceCacheMetaDocument>(
  {
    cacheKey: { type: String, required: true, unique: true },
    source: {
      type: String,
      required: true,
      enum: ['pluto-tv', 'samsung-tv-plus'],
    },
    region: { type: String, required: true },
    lastRefreshedAt: { type: Date, required: true },
    refreshInProgress: { type: Boolean, default: false },
    livenessCheckInProgress: { type: Boolean, default: false },
    lastLivenessCheckAt: { type: Date, default: null },
    channelCount: { type: Number, default: 0 },
    refreshDurationMs: { type: Number, default: 0 },
    livenessStats: {
      alive: { type: Number, default: 0 },
      dead: { type: Number, default: 0 },
      unknown: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

// ─── Channel (one doc per source+region+channel) ───────────
const livenessSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['alive', 'dead', 'unknown'],
      default: 'unknown',
    },
    lastCheckedAt: { type: Date, default: null },
    responseTimeMs: { type: Number, default: null },
    statusCode: { type: Number, default: null },
    error: { type: String, default: null },
    manifestValid: { type: Boolean, default: null },
    segmentReachable: { type: Boolean, default: null },
    manifestInfo: {
      type: new Schema(
        {
          isLive: Boolean,
          hasVideo: Boolean,
          segmentCount: Number,
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { _id: false },
);

const externalSourceChannelSchema = new Schema<IExternalSourceChannelDocument>(
  {
    source: {
      type: String,
      required: true,
      enum: ['pluto-tv', 'samsung-tv-plus'],
      index: true,
    },
    region: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    channelName: { type: String, required: true },
    streamUrl: { type: String, default: '' },
    tvgLogo: { type: String, default: null },
    groupTitle: { type: String, default: 'Uncategorized' },
    country: { type: String, default: null },
    summary: { type: String, default: null },
    codec: { type: String, default: null },
    bitrate: { type: Number, default: null },
    language: { type: String, default: null },
    votes: { type: Number, default: null },
    homepage: { type: String, default: null },
    liveness: {
      type: livenessSchema,
      default: () => ({ status: 'unknown' }),
    },
  },
  { timestamps: true },
);

// Unique compound for upsert dedup
externalSourceChannelSchema.index({ source: 1, region: 1, channelId: 1 }, { unique: true });
// Combined source+region+liveness filter
externalSourceChannelSchema.index({
  source: 1,
  region: 1,
  'liveness.status': 1,
});
// Text search — use custom language_override to avoid conflict with the 'language' field
externalSourceChannelSchema.index({ channelName: 'text' }, { language_override: 'textSearchLang' });

export const ExternalSourceCacheMeta = mongoose.model<IExternalSourceCacheMetaDocument>(
  'ExternalSourceCacheMeta',
  externalSourceCacheMetaSchema,
);

export const ExternalSourceChannel = mongoose.model<IExternalSourceChannelDocument>(
  'ExternalSourceChannel',
  externalSourceChannelSchema,
);

module.exports = { ExternalSourceCacheMeta, ExternalSourceChannel };
