/**
 * @file express.d.ts
 * @description Augments the Express Request interface with authenticated user shapes.
 *
 * Two properties are exposed:
 *
 * `req.user`    — Full Prisma `User` record. Set by `requireAuth`. Available on
 *                 every standard protected route. Provides `id`, `email`, `name`, etc.
 *
 * `req.jwtUser` — Minimal JWT-only shape. Set by `requireJwt`. Available ONLY on
 *                 `POST /auth/sync`, which must run before the DB record exists.
 *                 Contains only `supabaseId` and `email`.
 *
 * Keeping these separate eliminates the `User | JwtUser` union that previously
 * forced every route handler to cast `req.user` before accessing `id`.
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
       * Full Prisma User record. Set by `requireAuth` after a successful DB lookup.
       * Use on all standard protected routes. TypeScript will error if accessed
       * on a route that only uses `requireJwt`.
       */
      user: User;

      /**
       * JWT-only user shape. Set by `requireJwt` (no DB lookup).
       * Use ONLY on `POST /auth/sync`.
       */
      jwtUser: JwtUser;
    }
  }
}
