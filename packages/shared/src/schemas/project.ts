import { z } from 'zod';

export const CreateProjectSchema = z.object({
  title: z.string().max(100).optional(),
  discipline: z.string().min(1),
  description: z.string().max(500).optional(),
  coverImageUrl: z.string().url().optional(),
  status: z.enum(['private', 'in_progress', 'finalized']).default('in_progress'),
});

export const UpdateProjectSchema = CreateProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
