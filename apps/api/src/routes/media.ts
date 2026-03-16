import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import { createError } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';
import { getSignedUrl } from '../services/storageService';
import { MediaType } from '@prisma/client';

const router = Router();

const CreateMediaSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.enum(['image', 'audio', 'video', 'timelapse']),
  url: z.string().min(1),
  durationSec: z.number().int().positive().optional(),
  timestampInSession: z.number().int().nonnegative().optional(),
  isPublic: z.boolean().default(false),
});

// POST / — create media record
router.post(
  '/',
  requireAuth,
  validate(CreateMediaSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId, type, url, durationSec, timestampInSession, isPublic } =
      req.body as z.infer<typeof CreateMediaSchema>;
    const userId = req.user.id;

    const session = await prisma.checkinSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw createError('Session not found', 404, 'NOT_FOUND');
    }

    if (session.userId !== userId) {
      throw createError('You do not have access to this session', 403, 'FORBIDDEN');
    }

    const media = await prisma.checkinMedia.create({
      data: {
        sessionId,
        type: type as MediaType,
        url,
        isPublic,
        durationSec,
        timestampInSession,
      },
    });

    res.status(201).json({ data: media, error: null });
  })
);

// GET /signed-url — generate signed URL
router.get(
  '/signed-url',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { path } = req.query;

    if (!path || typeof path !== 'string') {
      throw createError('Missing required query parameter: path', 400, 'VALIDATION_ERROR');
    }

    const signedUrl = await getSignedUrl(path);
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    res.json({
      data: { signedUrl, expiresAt },
      error: null,
    });
  })
);

export default router;
