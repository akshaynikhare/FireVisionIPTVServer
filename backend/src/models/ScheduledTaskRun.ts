import mongoose, { Schema } from 'mongoose';

const subtaskSchema = new Schema(
  {
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
  },
  { _id: false },
);

const scheduledTaskRunSchema = new Schema(
  {
    taskName: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      required: true,
      default: 'pending',
      index: true,
    },
    trigger: {
      type: String,
      enum: ['scheduled', 'manual'],
      required: true,
    },
    triggeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    result: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
    subtasks: { type: [subtaskSchema], default: [] },
  },
  { timestamps: true },
);

scheduledTaskRunSchema.index({ taskName: 1, startedAt: -1 });
scheduledTaskRunSchema.index({ status: 1, startedAt: -1 });
// Only one 'running' record per task — enforced at DB level to prevent race conditions
scheduledTaskRunSchema.index(
  { taskName: 1 },
  { unique: true, partialFilterExpression: { status: 'running' } },
);

export const ScheduledTaskRun = mongoose.model('ScheduledTaskRun', scheduledTaskRunSchema);

module.exports = { ScheduledTaskRun };
