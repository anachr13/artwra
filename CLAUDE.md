# CLAUDE.md — Artwra

This file is the primary instruction source for Claude Code when building the Artwra project. Read it fully before writing any code.

---

## What is Artwra?

Artwra is a mobile app for visual artists to **document their creative work through immersive check-in sessions.** The entire Phase 1 product is a single, deeply polished feature: the creative session experience. Artists open the app, see their gallery of projects, begin a session, capture their process (photos, time-lapse, video clips, audio notes, text notes), and close with a reflection at checkout.

There is no community feed, no social export, no notifications in Phase 1. Ship one thing exceptionally well.

Full product details: `docs/prd.md`

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React Native (Expo SDK 51+) | Single codebase for iOS + Android |
| Backend | Node.js + Express | REST API |
| Database | PostgreSQL + Prisma ORM | See `docs/data-model.md` |
| Auth + Storage | Supabase | JWT auth, file storage for media |
| Push notifications | Expo Push Notifications | Via Expo server SDK |
| Camera | react-native-vision-camera v4 | Photos, video, native iOS time-lapse |
| Audio | expo-av | Voice note recording + playback |
| Media library | expo-media-library | Save exports to camera roll |
| Navigation | Expo Router (file-based) | |
| State management | Zustand | Lightweight, no Redux |
| Styling | NativeWind (Tailwind for RN) | |

Full architecture details: `docs/architecture.md`

---

## Project Structure

```
artwra/
├── CLAUDE.md                  ← You are here
├── docs/
│   ├── prd.md                 ← Full product requirements
│   ├── architecture.md        ← Tech decisions and folder layout
│   ├── data-model.md          ← Prisma schema + entity notes
│   ├── screens.md             ← Screen-by-screen UI specs
│   └── api-routes.md          ← All REST API endpoints
├── apps/
│   └── mobile/                ← Expo React Native app
│       ├── app/               ← Expo Router screens (file-based)
│       │   ├── (auth)/        ← Login, signup
│       │   ├── (tabs)/
│       │   │   └── gallery.tsx   ← FIRST SCREEN (app entry point)
│       │   ├── session/
│       │   │   ├── start.tsx     ← Session start (project + capture mode)
│       │   │   ├── active.tsx    ← Active session (timer, capture tools)
│       │   │   └── checkout.tsx  ← Check-out (review + reflection + save)
│       │   └── project/
│       │       ├── create.tsx    ← Create new project (modal)
│       │       └── [id]/edit.tsx ← Edit existing project (modal)
│       ├── components/        ← Shared UI components
│       ├── hooks/             ← Custom React hooks
│       ├── stores/            ← Zustand stores
│       ├── lib/               ← Supabase client, API client, utils
│       └── assets/            ← Fonts, icons, images
└── apps/
    └── api/                   ← Express backend
        ├── src/
        │   ├── routes/        ← Express route handlers
        │   ├── middleware/     ← Auth, error handling
        │   ├── services/      ← Business logic layer
        │   └── lib/           ← Prisma client, Supabase admin, push
        └── prisma/
            └── schema.prisma  ← Database schema
```

---

## Core Concepts to Understand

### Check-in Session
The entire product. An artist starts a session tied to a project. During the session:
- A **background timer** tracks elapsed time — soft, visible, non-intrusive
- The screen has a **breathing pulse animation** (warm, painterly, slow organic rhythm)
- The **screen sleeps normally** to save battery — except during time-lapse or video recording, where `expo-keep-awake` is used
- Capture tools: **photos**, **time-lapse** (native iOS camera time-lapse mode via `react-native-vision-camera`), **video clips** (up to 3 min each, multiple allowed), **audio notes**, **text notes**
- If the artist **closes the app mid-session**, the session auto-pauses and saves as a draft — all media preserved
- On return, the artist sees a paused session banner on the Gallery and can resume or go to check-out

### Session Draft Recovery
- Draft state persisted via Zustand + AsyncStorage
- Survives app restarts and device reboots
- A draft is only deleted when the artist explicitly discards it from the check-out screen

### Check-out Screen
A dedicated screen (not a modal) the artist reaches after ending a session. Feels like closing a journal.
- Review all captured media (photos, clips, audio, text notes)
- Add more media or notes post-session
- Write a **reflection note** ("How did this session feel?") — always private, stored separately
- Time-lapse preview (if time-lapse mode was used)
- Save or discard the session

### Project Types
- `in_progress` — Actively working on it; sessions run against it
- `finished` — Documentation of a completed work; no live timer needed

### Project Naming
Auto-placeholder format if the artist skips naming: **"Untitled — March 16"** (month + day of creation).

---

## Key Implementation Rules

### General
- Use **TypeScript** everywhere (strict mode)
- Never hardcode API URLs — use environment variables (`EXPO_PUBLIC_API_URL`, `DATABASE_URL`, etc.)
- All dates stored as UTC ISO strings in the DB; format in local timezone on the client
- Use **Prisma transactions** for any multi-table write operation
- Validate all API request bodies with **Zod** on the backend

### Authentication
- Auth is handled by **Supabase Auth** (email/password + magic link)
- The Express API validates the Supabase JWT on every protected route
- Middleware: `src/middleware/requireAuth.ts` — attaches `req.user` after verifying JWT
- Never store sensitive tokens in AsyncStorage; use **Expo SecureStore**

### Media / Storage
- All media (images, audio, video, time-lapse) goes to **Supabase Storage**
- Bucket: `checkin-media` (private, signed URLs for access)
- Bucket: `project-covers` (public)
- After upload, store only the storage path in `checkin_media.url` — never the full signed URL (those expire)
- `MediaType` enum has four values: `image`, `audio`, `video`, `timelapse`

### Camera Library
- Use **`react-native-vision-camera` v4** for all camera interactions (not `expo-camera`)
- Reason: `expo-camera` does not expose the native iOS Time-lapse camera mode. `react-native-vision-camera` provides full access to `AVCaptureSession` configurations including time-lapse
- For **photos**: use VisionCamera in photo mode
- For **video clips**: use VisionCamera in video mode, max 3 min enforced client-side
- For **time-lapse (iOS)**: use VisionCamera with `videoStabilizationMode` and the native time-lapse preset. Output is a `.mov` file saved to the local file system, then uploaded to Supabase Storage
- For **time-lapse (Android)**: fall back to standard video recording — show a tooltip explaining time-lapse is iOS only in Phase 1
- Audio notes are separate from camera — use `expo-av` for voice memo recording only

### Session Timer
- Use `expo-task-manager` + `expo-background-fetch` for the background timer
- Store `started_at` on session start; compute duration on wrap-up as `NOW() - started_at`
- Respect iOS Focus mode by checking `expo-notifications` permission state

### Background Animation (Active Session)
- Implement using **React Native Reanimated** (preferred) or a Lottie file
- Slow breathing pulse: expand → hold → contract → hold → repeat (~4s per breath)
- Colour palette: warm ochres, burnt siennas, soft cobalts — shifting over ~10 minutes
- Organic, soft — no sharp edges or geometric shapes
- Keep GPU cost minimal — avoid per-frame JS loops; use Reanimated's native driver or a pre-rendered Lottie
- Animation resumes exactly where it left off when the screen wakes from sleep

### Screen Wake Lock
- Use `expo-keep-awake` (`activateKeepAwakeAsync` / `deactivateKeepAwakeAsync`)
- Activate: when time-lapse interval is running OR video recording is active
- Deactivate: when time-lapse is paused/cancelled, when video stops, or when session ends
- Never keep the screen awake for idle sessions — battery conservation matters

---

## API Design Conventions

- Base path: `/api/v1`
- All responses wrapped: `{ data: ..., error: null }` or `{ data: null, error: { message, code } }`
- Pagination: cursor-based using `?cursor=<id>&limit=20`
- Auth header: `Authorization: Bearer <supabase_jwt>`
- HTTP status codes strictly followed (200, 201, 400, 401, 403, 404, 422, 500)

Full endpoint list: `docs/api-routes.md`

---

## Database Conventions

- All tables have `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
- All tables have `created_at TIMESTAMPTZ DEFAULT NOW()` and `updated_at TIMESTAMPTZ`
- Use Prisma `@updatedAt` directive for `updated_at`
- Soft-delete not used in Phase 1 — hard deletes only
- Foreign keys use `onDelete: Cascade` where child records are meaningless without parent

Full schema: `docs/data-model.md`

---

## Environment Variables

### Mobile (`.env` / `app.config.ts`)
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### API (`.env`)
```
DATABASE_URL=postgresql://...
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PORT=3000
```

---

## Phase 1 Scope — What to Build

Phase 1 is **only the creative check-in session experience**. Do not implement anything else.

**In scope:**
- Auth (sign up / login via Supabase)
- Gallery screen (artist's own projects, empty state, "Add Art")
- Project creation and editing
- Session start screen
- Active session screen (timer, breathing animation, all 5 capture tools)
- Session draft save + recovery on app reopen
- Check-out screen (review, add more, reflection note, save/discard)

**Not in scope for Phase 1 — do not build:**
- Community feed, reactions, comments, Q&A
- Follow system and follower feeds
- Push notifications
- Social export / promotional templates
- Direct messages
- Public gallery (other users' work)
- Real-time collaboration
- Paid features or marketplace
- Web app
- AI suggestions
- Analytics dashboard

---

## Where to Start

1. Read `docs/data-model.md` → set up Prisma schema and run migrations
2. Read `docs/api-routes.md` → scaffold the session-related Express routes
3. Read `docs/screens.md` → build Expo Router screens in this order:
   - Auth (login, signup)
   - Gallery
   - Project create/edit modal
   - Session start
   - Active session ← most complex; plan time for the animation and capture tools
   - Check-out
4. Wire Supabase auth end-to-end first — everything else depends on it
5. Build the Active Session screen next — it is the entire product
