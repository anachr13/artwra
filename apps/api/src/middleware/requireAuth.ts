/**
 * @file requireAuth.ts
 * @description Express middleware for protecting API routes.
 *
 * Two middlewares are exported:
 *
 * `requireAuth` — Full guard: validates the Supabase JWT AND confirms the user
 *   exists in PostgreSQL. Sets `req.user` to the full Prisma User record. Use
 *   this on all standard protected routes.
 *
 * `requireJwt` — JWT-only guard: validates the Supabase JWT but skips the DB
 *   lookup. Sets `req.user` to `{ supabaseId, email }`. Use ONLY on
 *   `POST /auth/sync`, which must run before the DB record exists.
 */
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { prisma } from '../lib/prisma';

/**
 * Extracts and validates the Bearer token from the Authorization header.
 * Responds 401 and returns null if the header is missing or malformed.
 *
 * @param req - Express request
 * @param res - Express response
 * @returns Token string, or null if the request was already rejected
 */
function extractBearerToken(req: Request, res: Response): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      data: null,
      error: {
        message: 'Missing or invalid authorization header',
        code: 'UNAUTHORIZED',
      },
    });
    return null;
  }

  return authHeader.substring(7);
}

/**
 * Full authentication middleware.
 * Validates the JWT and looks up the user in PostgreSQL.
 * Sets `req.user` to the full Prisma User record.
 * Returns 404 if the user doesn't exist in the database.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req, res);
  if (!token) return;

  const { data: { user: supabaseUser }, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !supabaseUser) {
    res.status(401).json({
      data: null,
      error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' },
    });
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
  });

  if (!dbUser) {
    res.status(404).json({
      data: null,
      error: {
        message: 'User not found in database. Please complete registration.',
        code: 'NOT_FOUND',
      },
    });
    return;
  }

  req.user = dbUser;
  next();
}

/**
 * JWT-only authentication middleware.
 * Validates the JWT but skips the PostgreSQL user lookup entirely.
 * Sets `req.user` to `{ supabaseId, email }` — the minimal shape needed by
 * `POST /auth/sync` to create or update the DB record.
 *
 * Use ONLY on routes that must run before a DB user record exists.
 */
export async function requireJwt(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req, res);
  if (!token) return;

  const { data: { user: supabaseUser }, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !supabaseUser) {
    res.status(401).json({
      data: null,
      error: { message: 'Invalid or expired token', code: 'UNAUTHORIZED' },
    });
    return;
  }

  // Only supabaseId and email are needed — the sync route handles its own upsert.
  // Use req.jwtUser (not req.user) so routes using requireAuth continue to get
  // the full Prisma User on req.user with no casting required.
  req.jwtUser = {
    supabaseId: supabaseUser.id,
    email: supabaseUser.email ?? '',
  };

  next();
}
