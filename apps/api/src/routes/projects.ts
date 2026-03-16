import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import { createError } from '../middleware/errorHandler';
import { prisma } from '../lib/prisma';
import { ProjectStatus } from '@prisma/client';

const router = Router();

const CreateProjectSchema = z.object({
  title: z.string().max(100).optional(),
  discipline: z.string().min(1),
  description: z.string().max(500).optional(),
  coverImageUrl: z.string().url().optional(),
  status: z.enum(['private', 'in_progress', 'finalized']).default('in_progress'),
});

const UpdateProjectSchema = z.object({
  title: z.string().max(100).optional(),
  discipline: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  status: z.enum(['private', 'in_progress', 'finalized']).optional(),
});

const STATUS_ORDER: Record<ProjectStatus, number> = {
  private: 0,
  in_progress: 1,
  finalized: 2,
};

// GET / — list user's projects
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user.id;

    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        checkinSessions: {
          select: {
            id: true,
            startedAt: true,
            durationSec: true,
          },
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    const projectsWithStats = projects.map((p) => {
      const { checkinSessions, ...projectData } = p;
      const sessionCount = checkinSessions.length;
      const lastSessionAt = checkinSessions.length > 0 ? checkinSessions[0].startedAt : null;

      return {
        ...projectData,
        sessionCount,
        lastSessionAt,
      };
    });

    res.json({ data: projectsWithStats, error: null });
  })
);

// POST / — create project
router.post(
  '/',
  requireAuth,
  validate(CreateProjectSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { title, discipline, description, coverImageUrl, status } =
      req.body as z.infer<typeof CreateProjectSchema>;

    const now = new Date();
    const monthName = now.toLocaleString('en-US', { month: 'long' });
    const day = now.getDate();
    const autoTitle = title || `Untitled — ${monthName} ${day}`;

    const project = await prisma.project.create({
      data: {
        userId: req.user.id,
        title: autoTitle,
        discipline,
        description,
        coverImageUrl,
        status: status as ProjectStatus,
      },
    });

    res.status(201).json({ data: project, error: null });
  })
);

// GET /:id — get single project
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user.id;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        checkinSessions: {
          select: { id: true, startedAt: true, durationSec: true },
          orderBy: { startedAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw createError('Project not found', 404, 'NOT_FOUND');
    }

    if (project.userId !== userId) {
      throw createError('You do not have access to this project', 403, 'FORBIDDEN');
    }

    const { checkinSessions, ...projectData } = project;
    const sessionCount = checkinSessions.length;
    const lastSessionAt =
      checkinSessions.length > 0 ? checkinSessions[0].startedAt : null;

    res.json({
      data: { ...projectData, sessionCount, lastSessionAt },
      error: null,
    });
  })
);

// PATCH /:id — update project
router.patch(
  '/:id',
  requireAuth,
  validate(UpdateProjectSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user.id;

    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      throw createError('Project not found', 404, 'NOT_FOUND');
    }

    if (project.userId !== userId) {
      throw createError('You do not have permission to update this project', 403, 'FORBIDDEN');
    }

    const updates = req.body as z.infer<typeof UpdateProjectSchema>;

    if (updates.status) {
      const currentOrder = STATUS_ORDER[project.status];
      const newOrder = STATUS_ORDER[updates.status as ProjectStatus];
      if (newOrder < currentOrder) {
        throw createError(
          `Cannot move project status from ${project.status} to ${updates.status}`,
          422,
          'INVALID_TRANSITION'
        );
      }
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.discipline !== undefined && { discipline: updates.discipline }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.coverImageUrl !== undefined && { coverImageUrl: updates.coverImageUrl }),
        ...(updates.status !== undefined && { status: updates.status as ProjectStatus }),
      },
    });

    res.json({ data: updated, error: null });
  })
);

// DELETE /:id — delete project
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user.id;

    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      throw createError('Project not found', 404, 'NOT_FOUND');
    }

    if (project.userId !== userId) {
      throw createError('You do not have permission to delete this project', 403, 'FORBIDDEN');
    }

    await prisma.project.delete({ where: { id } });

    res.json({ data: { success: true }, error: null });
  })
);

export default router;
