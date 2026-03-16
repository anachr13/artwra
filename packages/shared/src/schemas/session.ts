import { z } from 'zod';

export const CreateSessionSchema = z.object({
  projectId: z.string().uuid(),
  captureMode: z.enum(['free_capture', 'timelapse']).default('free_capture'),
  startedAt: z.string().datetime(),
});

export const UpdateSessionSchema = z.object({
  endedAt: z.string().datetime().optional(),
  durationSec: z.number().int().positive().optional(),
  reflectionNote: z.string().optional(),
  isDraft: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;
