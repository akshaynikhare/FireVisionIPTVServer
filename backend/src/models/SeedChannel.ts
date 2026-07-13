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

// Unique index for YouTube-based seeds. Uses $type:'string' (not $exists) because
// the API create path writes explicit null for the unused field — $exists:true
// would still match those nulls and make every direct-URL seed collide.
seedChannelSchema.index(
  { source: 1, ytChannelId: 1 },
  { unique: true, partialFilterExpression: { ytChannelId: { $type: 'string' } } },
);
// Unique index for direct URL seeds (only enforced when directUrl is a string)
seedChannelSchema.index(
  { source: 1, directUrl: 1 },
  { unique: true, partialFilterExpression: { directUrl: { $type: 'string' } } },
);

export const SeedChannel = mongoose.model<ISeedChannelDocument>('SeedChannel', seedChannelSchema);

module.exports = { SeedChannel };
