import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { prisma } from '../lib/prisma';

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      data: null,
      error: {
        message: 'Missing or invalid authorization header',
        code: 'UNAUTHORIZED',
      },
    });
    return;
  }

  const token = authHeader.substring(7);

  const { data: { user: supabaseUser }, error: authError } =
    await supabase.auth.getUser(token);

  if (authError || !supabaseUser) {
    res.status(401).json({
      data: null,
      error: {
        message: 'Invalid or expired token',
        code: 'UNAUTHORIZED',
      },
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
