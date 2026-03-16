import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

// GET /api/v1/users/me
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ data: req.user, error: null });
}));

// PATCH /api/v1/users/me
const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  pushToken: z.string().optional(),
});

router.patch('/me', requireAuth, validate(UpdateUserSchema), asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: req.body,
  });
  res.json({ data: user, error: null });
}));

export default router;
