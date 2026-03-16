import { z } from 'zod';

export const channelMetadataSchema = z
  .object({
    country: z.string().optional(),
    language: z.string().optional(),
    resolution: z.string().optional(),
    tags: z.array(z.string()).optional(),
    lastTested: z.coerce.date().optional(),
    isWorking: z.boolean().optional(),
    responseTime: z.number().optional(),
  })
  .optional();

export const createChannelSchema = z.object({
  channelId: z.string().min(1, 'Channel ID is required'),
  channelName: z.string().trim().min(1, 'Channel name is required'),
  channelUrl: z.string().min(1, 'Channel URL is required'),
  channelImg: z.string().default(''),
  channelGroup: z.string().default('Uncategorized'),
  channelDrmKey: z.string().default(''),
  channelDrmType: z.string().default(''),
  tvgName: z.string().default(''),
  tvgLogo: z.string().default(''),
  order: z.number().int().default(0),
  metadata: channelMetadataSchema,
});

export const updateChannelSchema = createChannelSchema.partial();

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
