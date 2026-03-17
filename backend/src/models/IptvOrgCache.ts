import mongoose, { Schema } from 'mongoose';
import { IIptvOrgCacheMetaDocument, IIptvOrgChannelDocument } from '@firevision/shared';

// ─── Cache Metadata (singleton) ───────────────────────────
const iptvOrgCacheMetaSchema = new Schema<IIptvOrgCacheMetaDocument>(
  {
    cacheKey: {
      type: String,
      required: true,
      unique: true,
      default: 'iptv-org-main',
    },
    lastRefreshedAt: { type: Date, required: true },
    refreshInProgress: { type: Boolean, default: false },
    livenessCheckInProgress: { type: Boolean, default: false },
    lastLivenessCheckAt: { type: Date, default: null },
    sourceCounts: {
      channels: { type: Number, default: 0 },
      streams: { type: Number, default: 0 },
      languages: { type: Number, default: 0 },
      guides: { type: Number, default: 0 },
      feeds: { type: Number, default: 0 },
      logos: { type: Number, default: 0 },
    },
    enrichedCount: { type: Number, default: 0 },
    refreshDurationMs: { type: Number, default: 0 },
    livenessStats: {
      alive: { type: Number, default: 0 },
      dead: { type: Number, default: 0 },
      unknown: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

// ─── Enriched Channel (one doc per stream) ────────────────
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

const iptvOrgChannelSchema = new Schema<IIptvOrgChannelDocument>(
  {
    channelId: { type: String, required: true, index: true },
    channelName: { type: String, required: true },
    streamUrl: { type: String, required: true },
    streamQuality: { type: String, default: null },
    streamUserAgent: { type: String, default: null },
    streamReferrer: { type: String, default: null },
    tvgLogo: { type: String, default: null },
    country: { type: String, default: null, index: true },
    categories: { type: [String], default: [], index: true },
    languageCodes: { type: [String], default: [], index: true },
    languageNames: { type: [String], default: [] },
    channelNetwork: { type: String, default: null },
    channelWebsite: { type: String, default: null },
    channelIsNsfw: { type: Boolean, default: false },
    channelGroup: { type: String, default: 'Uncategorized' },
    liveness: { type: livenessSchema, default: () => ({ status: 'unknown' }) },
  },
  { timestamps: true },
);

// Unique compound for upsert dedup
iptvOrgChannelSchema.index({ channelId: 1, streamUrl: 1 }, { unique: true });
// Filter queries (split to avoid parallel array index restriction)
iptvOrgChannelSchema.index({ country: 1, categories: 1 });
iptvOrgChannelSchema.index({ country: 1, languageCodes: 1 });
// Liveness filtering
iptvOrgChannelSchema.index({ 'liveness.status': 1 });
iptvOrgChannelSchema.index({ country: 1, 'liveness.status': 1 });
// Text search
iptvOrgChannelSchema.index({ channelName: 'text' });

export const IptvOrgCacheMeta = mongoose.model<IIptvOrgCacheMetaDocument>(
  'IptvOrgCacheMeta',
  iptvOrgCacheMetaSchema,
);

export const IptvOrgChannel = mongoose.model<IIptvOrgChannelDocument>(
  'IptvOrgChannel',
  iptvOrgChannelSchema,
);

module.exports = { IptvOrgCacheMeta, IptvOrgChannel };
