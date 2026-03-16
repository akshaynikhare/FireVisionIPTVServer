import mongoose, { Schema, Model } from 'mongoose';
import { IEpgProgramDocument } from '@firevision/shared';

const epgProgramSchema = new Schema<IEpgProgramDocument>(
  {
    channelEpgId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
    category: {
      type: [String],
      default: [],
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    icon: {
      type: String,
      default: null,
    },
    language: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Primary query index: find programs for a channel in a time range
epgProgramSchema.index({ channelEpgId: 1, startTime: 1 });

// TTL index: auto-delete programs 24 hours after they end
// Note: aligned with epg-service filter which skips programs older than 24h
epgProgramSchema.index({ endTime: 1 }, { expireAfterSeconds: 86400 });

const EpgProgram = mongoose.model<IEpgProgramDocument>('EpgProgram', epgProgramSchema);

module.exports = EpgProgram;
export default EpgProgram;
