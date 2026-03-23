/**
 * @file auth.ts
 * @description Auth routes — currently only `POST /auth/sync`.
 *
 * Sync is called after every OAuth sign-in and on app startup. It creates the
 * DB user record on first sign-in, and updates only the `email` field on
 * subsequent calls so that customised names and usernames are never overwritten.
 */
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

/**
 * Generate a unique username by appending a random 4-character suffix.
 * Called when the base username is already taken by another user.
 *
 * @param base - The desired username (already validated, max 30 chars)
 * @returns A unique username with a suffix appended, e.g. "john_k3x2"
 */
async function resolveUniqueUsername(base: string): Promise<string> {
  // Truncate base to 25 chars to leave room for the _xxxx suffix.
  const truncated = base.slice(0, 25);

  // Try up to 10 random suffixes before giving up.
  for (let i = 0; i < 10; i++) {
    const suffix = Math.random().toString(36).slice(2, 6); // e.g. "k3x2"
    const candidate = `${truncated}_${suffix}`;
    const existing = await prisma.user.findUnique({ where: { username: candidate } });
    if (!existing) return candidate;
  }

  // Extremely unlikely — fall back to a full random username.
  return `user_${Math.random().toString(36).slice(2, 10)}`;
}

router.post(
  '/sync',
  requireJwt,
  validate(AuthSyncSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, username, disciplines } = req.body as z.infer<typeof AuthSyncSchema>;
    const { supabaseId, email } = req.jwtUser;

    const existingUser = await prisma.user.findUnique({
      where: { supabaseId },
    });

    if (existingUser) {
      // User already exists — only refresh the email address (which can change
      // on an OAuth provider). Never overwrite name, username, or disciplines
      // because the user may have customised them since first sign-in.
      const user = await prisma.user.update({
        where: { supabaseId },
        data: { email },
      });

      res.status(200).json({ data: user, error: null });
      return;
    }

    // First-time sync — create the DB record.
    // Handle the unlikely case where the auto-generated username collides with
    // an existing one (e.g. two users whose email prefixes are identical).
    let resolvedUsername = username;
    const usernameConflict = await prisma.user.findUnique({ where: { username } });
    if (usernameConflict) {
      resolvedUsername = await resolveUniqueUsername(username);
    }

    const user = await prisma.user.create({
      data: {
        supabaseId,
        email,
        name,
        username: resolvedUsername,
        disciplines,
      },
    });

    // 201 Created — a new resource was created.
    res.status(201).json({ data: user, error: null });
  })
);

export default router;
