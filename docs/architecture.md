# Architecture — Artwra

## Overview

Artwra uses a monorepo structure with two apps: a React Native mobile app (Expo) and a Node.js REST API. Supabase handles auth and file storage. PostgreSQL with Prisma is the database.

---

## Repository Layout

```
artwra/
├── apps/
│   ├── mobile/          ← Expo React Native (iOS + Android)
│   └── api/             ← Node.js + Express REST API
├── packages/
│   └── shared/          ← Shared TypeScript types, Zod schemas
├── docs/
├── CLAUDE.md
├── package.json         ← Root workspace (npm workspaces or pnpm)
└── .env.example
```

---

## Mobile App (`apps/mobile`)

### Framework
- **Expo SDK 51+** with Expo Router (file-based navigation)
- **React Native** for iOS and Android from a single codebase

### Navigation structure (Expo Router)
```
app/
├── _layout.tsx              ← Root layout, auth gate
├── (auth)/
│   ├── _layout.tsx
│   ├── login.tsx
│   └── signup.tsx
├── (tabs)/
│   ├── _layout.tsx          ← Bottom tab bar
│   ├── index.tsx            ← Home screen
│   ├── studio.tsx           ← Session / Studio screen
│   ├── gallery.tsx          ← Public gallery
│   ├── community.tsx        ← Community feed
│   └── profile.tsx          ← Own profile
├── project/
│   └── [id].tsx             ← Project detail (public or own)
├── user/
│   └── [id].tsx             ← Other user's profile
├── notifications.tsx
├── export/
│   └── [projectId].tsx      ← Export / promote screen
└── messages/
    ├── index.tsx            ← DM inbox
    └── [conversationId].tsx ← DM thread
```

### State management
- **Zustand** for global app state
- Store files in `stores/`:
  - `authStore.ts` — current user, session token
  - `sessionStore.ts` — active check-in session state (timer, captures)
  - `feedStore.ts` — gallery + community feed cache
  - `notificationStore.ts` — unread count, notification list

### Key libraries
| Package | Purpose |
|---|---|
| `zustand` | State management |
| `nativewind` | Tailwind-style classes for RN |
| `@supabase/supabase-js` | Auth + storage client |
| `expo-router` | File-based navigation |
| `expo-camera` | Photo capture during sessions |
| `expo-av` | Audio recording (voice notes) + video playback |
| `expo-media-library` | Save exports to camera roll |
| `expo-task-manager` | Background timer task |
| `expo-background-fetch` | Background task registration |
| `expo-notifications` | Push notification handling |
| `expo-secure-store` | Secure token storage |
| `expo-sharing` | Share sheet for social export |
| `react-query` | Server state / data fetching |
| `zod` | Runtime validation (shared schemas) |
| `dayjs` | Date formatting |

### API client (`lib/api.ts`)
- Axios instance configured with base URL from `EXPO_PUBLIC_API_URL`
- Interceptor attaches Supabase JWT to every request
- Interceptor handles 401 → trigger re-auth flow

---

## API (`apps/api`)

### Framework
- **Node.js + Express**
- TypeScript with strict mode
- **Prisma** as ORM

### Folder structure
```
apps/api/
├── src/
│   ├── index.ts             ← App entry, Express setup
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── projects.ts
│   │   ├── sessions.ts
│   │   ├── media.ts
│   │   ├── reactions.ts
│   │   ├── comments.ts
│   │   ├── questions.ts
│   │   ├── followers.ts
│   │   ├── notifications.ts
│   │   ├── messages.ts
│   │   └── export.ts
│   ├── middleware/
│   │   ├── requireAuth.ts   ← Validates Supabase JWT, sets req.user
│   │   ├── errorHandler.ts  ← Global error handler
│   │   └── validate.ts      ← Zod request body validator factory
│   ├── services/
│   │   ├── notificationService.ts  ← Expo Push server SDK calls
│   │   ├── exportService.ts        ← Video/image export assembly
│   │   └── storageService.ts       ← Supabase Storage signed URLs
│   └── lib/
│       ├── prisma.ts        ← Prisma client singleton
│       ├── supabase.ts      ← Supabase admin client
│       └── push.ts          ← Expo server SDK client
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── .env
```

### Middleware pipeline (per request)
1. `cors()` — allow mobile app origin
2. `express.json()` — parse body
3. `requireAuth` — on protected routes
4. Route handler
5. `errorHandler` — catch-all error response formatter

### Error handling convention
All route handlers wrapped in `asyncHandler(fn)` utility. Errors thrown are caught by `errorHandler` middleware and formatted as:
```json
{ "data": null, "error": { "message": "...", "code": "ERROR_CODE" } }
```

---

## Database (PostgreSQL + Prisma)

- Hosted on **Supabase** (Postgres instance included)
- Prisma handles migrations and type-safe queries
- Schema file: `apps/api/prisma/schema.prisma`
- Full schema: `docs/data-model.md`

---

## Auth (Supabase Auth)

- **Flow**: email + password sign-up/login via Supabase Auth
- Magic link login also supported
- On sign-up, a `users` row is created in the app DB (via Supabase DB trigger or API webhook)
- The mobile app stores the Supabase session in `expo-secure-store`
- The API validates the JWT using the Supabase JWT secret (`SUPABASE_JWT_SECRET`)

### Auth flow diagram
```
Mobile → Supabase Auth → JWT returned
Mobile → API request with JWT in Authorization header
API middleware → verifies JWT with Supabase admin client
API middleware → looks up user in DB by supabase_user_id
API middleware → attaches user to req.user
Route handler → proceeds with req.user
```

---

## File Storage (Supabase Storage)

Two buckets:

| Bucket | Access | Contents |
|---|---|---|
| `checkin-media` | Private | Session photos + audio |
| `project-covers` | Public | Project cover images |

For `checkin-media`, the API generates signed URLs (valid 1 hour) for client access. Never expose raw storage paths to the client.

---

## Push Notifications

- Client registers for push token via `expo-notifications` on app launch
- Token sent to `PATCH /api/v1/users/me` and stored in `users.push_token`
- Backend uses `expo-server-sdk` to send notifications
- All notification sends happen in `services/notificationService.ts`
- Notification payloads include `screen` and `referenceId` for deep linking

---

## Background Session Timer

- Registered via `expo-task-manager` as `BACKGROUND_TIMER_TASK`
- Uses `expo-background-fetch` for periodic tick (every 15s)
- Timer state (started_at, paused_at) stored in Zustand + AsyncStorage for persistence across app restarts
- On session wrap, elapsed time calculated server-side from `started_at` → `ended_at`

---

## Social Export Pipeline

1. Client requests export → `POST /api/v1/export/:projectId`
2. API fetches all public `checkin_media` for the project (images only, ordered by timestamp)
3. Returns signed URLs to client
4. Client assembles export locally using `expo-av` (reel) or canvas overlay (card/quote)
5. Client saves to camera roll via `expo-media-library`
6. Client triggers share sheet via `expo-sharing`

Export assembly happens on-device to avoid server-side video processing costs.

---

## Shared Package (`packages/shared`)

TypeScript types and Zod schemas shared between mobile and API:

```
packages/shared/
├── types/
│   ├── user.ts
│   ├── project.ts
│   ├── session.ts
│   └── ...
└── schemas/
    ├── createProject.ts
    ├── createSession.ts
    └── ...
```

Import in mobile: `import { CreateProjectSchema } from '@artwra/shared'`
Import in API: same

---

## Development Setup

```bash
# Install dependencies
pnpm install

# Start API (with hot reload)
pnpm --filter api dev

# Start Expo mobile app
pnpm --filter mobile start

# Run Prisma migrations
pnpm --filter api prisma migrate dev

# Generate Prisma client
pnpm --filter api prisma generate
```

---

## Environment Variables

See `CLAUDE.md` for the full list. Never commit `.env` files — only `.env.example`.
