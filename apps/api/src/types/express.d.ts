/**
 * @file express.d.ts
 * @description Augments the Express Request interface with the authenticated user.
 *
 * Two shapes are supported:
 * - `User` (Prisma model) — set by `requireAuth` after a DB lookup. Used by all
 *   standard protected routes.
 * - `JwtUser` — set by `requireJwt` (JWT validation only, no DB lookup). Used
 *   exclusively by `POST /auth/sync`, which runs before the DB record exists on
 *   first sign-up.
 */
import { User } from '@prisma/client';

/**
 * Minimal user shape populated by `requireJwt`.
 * Contains only the fields extractable from the Supabase JWT — no DB fields.
 */
export interface JwtUser {
  /** The Supabase Auth UUID — matches `users.supabase_id` in PostgreSQL. */
  supabaseId: string;
  /** Email address extracted from the Supabase JWT claims. */
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      /**
       * Set by `requireAuth` (full Prisma User) or `requireJwt` (JWT-only).
       * Routes using `requireJwt` must only access `supabaseId` and `email`.
       */
      user: User | JwtUser;
    }
  }
}
