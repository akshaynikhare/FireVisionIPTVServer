import { z } from 'zod';

export const userRoleSchema = z.enum(['Admin', 'User']);

export const createUserSchema = z.object({
  username: z.string().trim().min(3).max(50),
  password: z.string().min(6),
  email: z.string().email().trim().toLowerCase(),
  role: userRoleSchema.default('User'),
  channelListCode: z.string().length(6).toUpperCase().optional(),
  isActive: z.boolean().default(true),
  profilePicture: z.string().nullable().default(null),
});

export const updateUserSchema = createUserSchema.partial().omit({ channelListCode: true });

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
