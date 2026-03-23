import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireJwt } from '../middleware/requireAuth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import { prisma } from '../lib/prisma';

const router = Router();

const AuthSyncSchema = z.object({
  name: z.string().min(1).max(100),
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_]+$/),
  disciplines: z.array(z.string()).min(1),
});

router.post(
  '/sync',
  requireJwt,
  validate(AuthSyncSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, username, disciplines } = req.body as z.infer<typeof AuthSyncSchema>;
    const { supabaseId, email } = req.user;

    const existingUser = await prisma.user.findUnique({
      where: { supabaseId },
    });

    let user;
    if (existingUser) {
      user = await prisma.user.update({
        where: { supabaseId },
        data: {
          name,
          username,
          disciplines,
          email,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          supabaseId,
          email,
          name,
          username,
          disciplines,
        },
      });
    }

    res.status(200).json({
      data: user,
      error: null,
    });
  })
);

export default router;
