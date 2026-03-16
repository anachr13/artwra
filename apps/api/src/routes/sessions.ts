import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import { createError } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';
import { deleteFile } from '../services/storageService';
import { CaptureMode } from '@prisma/client';

const router = Router();

const CreateSessionSchema = z.object({
  projectId: z.string().uuid(),
  captureMode: z.enum(['free_capture', 'timelapse']).default('free_capture'),
  startedAt: z.string().datetime(),
});

const UpdateSessionSchema = z.object({
  endedAt: z.string().datetime().optional(),
  durationSec: z.number().int().positive().optional(),
  reflectionNote: z.string().optional(),
  isDraft: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

const UpdateMediaSchema = z.object({
  isPublic: z.boolean(),
});

// POST / — create session
router.post(
  '/',
  requireAuth,
  validate(CreateSessionSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { projectId, captureMode, startedAt } = req.body as z.infer<typeof CreateSessionSchema>;
    const userId = req.user.id;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw createError('Project not found', 404, 'NOT_FOUND');
    }

    if (project.userId !== userId) {
      throw createError('You do not have access to this project', 403, 'FORBIDDEN');
    }

    const session = await prisma.checkinSession.create({
      data: {
        projectId,
        userId,
        captureMode: captureMode as CaptureMode,
        startedAt: new Date(startedAt),
        isDraft: true,
      },
      include: { media: true },
    });

    res.status(201).json({ data: session, error: null });
  })
);

// GET /:id — get session with media
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user.id;

    const session = await prisma.checkinSession.findUnique({
      where: { id },
      include: { media: { orderBy: { timestamp: 'asc' } } },
    });

    if (!session) {
      throw createError('Session not found', 404, 'NOT_FOUND');
    }

    if (session.userId !== userId) {
      throw createError('You do not have access to this session', 403, 'FORBIDDEN');
    }

    res.json({ data: session, error: null });
  })
);

// PATCH /:id — update session
router.patch(
  '/:id',
  requireAuth,
  validate(UpdateSessionSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body as z.infer<typeof UpdateSessionSchema>;

    const session = await prisma.checkinSession.findUnique({ where: { id } });

    if (!session) {
      throw createError('Session not found', 404, 'NOT_FOUND');
    }

    if (session.userId !== userId) {
      throw createError('You do not have permission to update this session', 403, 'FORBIDDEN');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedSession = await tx.checkinSession.update({
        where: { id },
        data: {
          ...(updates.endedAt !== undefined && { endedAt: new Date(updates.endedAt) }),
          ...(updates.durationSec !== undefined && { durationSec: updates.durationSec }),
          ...(updates.reflectionNote !== undefined && { reflectionNote: updates.reflectionNote }),
          ...(updates.isDraft !== undefined && { isDraft: updates.isDraft }),
          ...(updates.isPublic !== undefined && { isPublic: updates.isPublic }),
        },
        include: { media: true },
      });

      // If session is being finalized, update project totalSessionsSec
      if (updates.durationSec !== undefined && updates.isDraft === false) {
        await tx.project.update({
          where: { id: session.projectId },
          data: {
            totalSessionsSec: {
              increment: updates.durationSec,
            },
          },
        });

        await tx.user.update({
          where: { id: userId },
          data: {
            totalSessionsSec: {
              increment: updates.durationSec,
            },
          },
        });
      }

      return updatedSession;
    });

    res.json({ data: updated, error: null });
  })
);

// DELETE /:id — delete session + media
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user.id;

    const session = await prisma.checkinSession.findUnique({
      where: { id },
      include: { media: true },
    });

    if (!session) {
      throw createError('Session not found', 404, 'NOT_FOUND');
    }

    if (session.userId !== userId) {
      throw createError('You do not have permission to delete this session', 403, 'FORBIDDEN');
    }

    // Delete files from Supabase Storage
    const deletePromises = session.media.map((m) =>
      deleteFile(m.url).catch((err: Error) => {
        console.error(`Failed to delete storage file ${m.url}:`, err.message);
      })
    );
    await Promise.all(deletePromises);

    // Cascade delete will remove media records
    await prisma.checkinSession.delete({ where: { id } });

    res.json({ data: { success: true }, error: null });
  })
);

// PATCH /:id/media/:mediaId — update media visibility
router.patch(
  '/:id/media/:mediaId',
  requireAuth,
  validate(UpdateMediaSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, mediaId } = req.params;
    const userId = req.user.id;
    const { isPublic } = req.body as z.infer<typeof UpdateMediaSchema>;

    const session = await prisma.checkinSession.findUnique({ where: { id } });

    if (!session) {
      throw createError('Session not found', 404, 'NOT_FOUND');
    }

    if (session.userId !== userId) {
      throw createError('You do not have permission to update this media', 403, 'FORBIDDEN');
    }

    const media = await prisma.checkinMedia.findUnique({ where: { id: mediaId } });

    if (!media || media.sessionId !== id) {
      throw createError('Media not found', 404, 'NOT_FOUND');
    }

    const updated = await prisma.checkinMedia.update({
      where: { id: mediaId },
      data: { isPublic },
    });

    res.json({ data: updated, error: null });
  })
);

export default router;
