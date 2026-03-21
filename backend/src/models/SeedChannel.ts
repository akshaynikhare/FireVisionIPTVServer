import mongoose, { Schema } from 'mongoose';
import { ISeedChannelDocument } from '@firevision/shared';

const seedChannelSchema = new Schema<ISeedChannelDocument>(
  {
    ytChannelId: { type: String },
    directUrl: { type: String },
    channelName: { type: String, required: true },
    tvgLogo: { type: String, default: '' },
    groupTitle: { type: String, default: 'Uncategorized' },
    language: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    source: {
      type: String,
      required: true,
      enum: ['youtube-live', 'prasar-bharati'],
      index: true,
    },
  },
  { timestamps: true },
);

// Unique index for YouTube-based seeds (sparse so nulls don't conflict)
seedChannelSchema.index({ source: 1, ytChannelId: 1 }, { unique: true, sparse: true });
// Unique index for direct URL seeds
seedChannelSchema.index({ source: 1, directUrl: 1 }, { unique: true, sparse: true });

export const SeedChannel = mongoose.model<ISeedChannelDocument>('SeedChannel', seedChannelSchema);

module.exports = { SeedChannel };
