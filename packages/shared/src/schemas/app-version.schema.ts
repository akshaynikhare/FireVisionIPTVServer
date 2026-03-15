import { z } from 'zod';

export const createAppVersionSchema = z.object({
  versionName: z.string().min(1, 'Version name is required'),
  versionCode: z.number().int().positive(),
  apkFileName: z.string().min(1),
  apkFileSize: z.number().positive(),
  downloadUrl: z.string().min(1),
  releaseNotes: z.string().default(''),
  isActive: z.boolean().default(true),
  isMandatory: z.boolean().default(false),
  minCompatibleVersion: z.number().int().default(1),
});

export const updateAppVersionSchema = createAppVersionSchema.partial();

export type CreateAppVersionInput = z.infer<typeof createAppVersionSchema>;
export type UpdateAppVersionInput = z.infer<typeof updateAppVersionSchema>;
