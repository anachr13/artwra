import { z } from 'zod';

export const AuthSyncSchema = z.object({
  name: z.string().min(1).max(100),
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_]+$/),
  disciplines: z.array(z.string()).min(1),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const SignupSchema = z.object({
  name: z.string().min(1).max(100),
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  disciplines: z.array(z.string()).min(1),
});

export type AuthSyncInput = z.infer<typeof AuthSyncSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
