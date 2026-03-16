# Screens — Artwra (Phase 1)

Phase 1 ships exactly five screens. Build them in this order — each one depends on the one before it.

1. Gallery (app entry point)
2. Session Start
3. Active Session
4. Check-out
5. Project Create / Edit (modal)

Auth screens (Login, Sign Up) are prerequisites — build those first, before any of the above.

---

## Auth Screens

### Login (`app/(auth)/login.tsx`)
- Email + password fields
- "Log in" button → Supabase `signInWithPassword`
- "Forgot password?" → Supabase `resetPasswordForEmail`
- "Create an account" link → signup
- On success → replace stack with `/(tabs)/gallery`

### Sign Up (`app/(auth)/signup.tsx`)
- Fields: name, username, email, password
- Discipline multi-select: Painter, Sculptor, Photographer, Ceramics, Printmaker, Illustrator, Other
- "Create account" → Supabase `signUp` → `POST /api/v1/auth/sync`
- On success → navigate to `/(tabs)/gallery`

---

## Screen 1 — Gallery (`app/(tabs)/gallery.tsx`)

**This is the first screen the artist sees when they open the app.**

### Empty state
When the artist has no projects:
- Full-screen, centred layout
- Artwra logo / wordmark at top
- Brief warm tagline: *"Your creative work lives here"*
- Single large **"Add Art"** button — the only CTA
- Tapping "Add Art" opens the Project Create modal (see Screen 5)

### Populated state
- Grid layout (2 columns on phone)
- Each project card:
  - Cover image (aspect ratio 4:3) — placeholder if none set (warm gradient with a brush stroke icon)
  - Project name (truncated to 2 lines)
  - Status pill: `In Progress` (amber) or `Finished` (muted green)
  - Last session date (relative: "2 days ago")
- **"+"** floating action button (bottom right) — opens Project Create modal
- Tapping a project card → navigates to Session Start for that project

### Returning from a paused session
If a draft session exists when the app opens:
- The Gallery still loads as normal
- A **soft banner** appears at the top: *"You have a paused session — [Project Name]"* with a "Resume" button
- Tapping "Resume" → navigates to Active Session (paused state)
- The banner is dismissible (swipe up), but the draft is not deleted until the artist explicitly discards it from the session screen

### Navigation
- No bottom tab bar in Phase 1 — Gallery is the only root screen
- All other screens are pushed on top of it

---

## Screen 2 — Session Start (`app/session/start.tsx`)

**Accessed by tapping a project card in the Gallery.**

A calm, minimal screen. The goal is to remove friction — the artist should be able to begin in two taps.

### UI elements

**Project header (top)**
- Cover image (full-width, dimmed) as background
- Project name in large, clean type
- Status pill

**Capture mode selector (centre)**
Label: *"How do you want to capture today?"*
This setting does not lock the artist into one mode — it just sets a default. They can use all capture tools at any time during the session regardless of this choice. The selector is a hint about their primary intent.

Two options displayed as soft toggle cards:
- **Free capture** — "I'll capture in the moment" — default. All tools available; no automatic anything.
- **Time-lapse** — "Record my workspace over time" — pre-arms the time-lapse tool so it is prominently surfaced during the session.

**Important:** The old "Every 5/10/30 min" interval auto-capture concept is removed. Time-lapse is now a native iOS camera mode (a continuous recording), not a scheduled photo task. There is no interval to configure at session start.

Default: Free capture selected.

**Begin Session button (bottom)**
- Large, full-width, prominent
- Label: "Begin Session"
- Tapping → navigates to Active Session and starts the timer

**"Start a new project instead" link**
- Small, below the Begin button
- Opens Project Create modal, then returns here with the new project pre-selected

---

## Screen 3 — Active Session (`app/session/active.tsx`)

**The core product screen. Design with care.**

### Layout overview
```
┌─────────────────────────────────┐
│  [Project name]      [Timer]    │  ← Top bar (minimal, low opacity)
│                                 │
│                                 │
│        Breathing pulse bg       │  ← Animated background fills this area
│         (warm colour wash)      │
│                                 │
│                                 │
│  [Notes] [Photo] [TL] [Vid] [Audio]  │  ← Bottom capture toolbar
└─────────────────────────────────┘
```

### Background animation
- A slow, organic breathing pulse — expanding and contracting rhythm, like breath or a heartbeat
- Built with **React Native Reanimated** (preferred) or a Lottie animation
- Warm, painterly colour palette: deep ochres, burnt siennas, soft cobalts — shifting extremely slowly (a full colour cycle over ~10 minutes)
- No sharp edges, no geometric shapes — everything soft and organic
- Animation does not stop or reset when the screen returns from sleep
- Keep GPU cost minimal — use a pre-rendered Lottie or a shader-based gradient with Reanimated, not a per-frame JS loop

### Top bar
- **Left:** Project name (truncated, max 20 chars)
- **Right:** Session timer — `HH:MM:SS` format, small font size (~14pt), opacity ~40%, white
- The top bar itself should be nearly invisible — only revealed on a soft tap of the screen if the artist wants to hide it completely

### Capture toolbar (bottom)
Persistent. Five tools arranged in a horizontal row with icon + label:

#### 1. Text Note (📝)
- Tap → slides up a text input sheet from the bottom
- Placeholder: *"What are you noticing?"*
- Auto-saves with a timestamp when the sheet is dismissed
- Multiple notes per session, each stored separately

#### 2. Photo (📷)
- Tap → opens device camera in photo mode
- Photo is taken and immediately added to the session's media collection
- A small thumbnail confirmation appears briefly at the bottom ("Photo added")
- Multiple photos per session

#### 3. Time-lapse (⏱) — iOS only in Phase 1
- Tap → opens the **native iOS Time-lapse camera mode** via `react-native-vision-camera`
- The camera UI is the native iOS camera in time-lapse mode — the OS handles adaptive frame-rate compression
- The artist frames their workspace and taps the record button; the camera runs in time-lapse mode until they tap stop
- Output is a single `.mov` file (already a time-lapse video — no post-processing needed)
- On stop → file is saved locally, thumbnail confirmation shown in the media tray
- **Multiple time-lapse recordings allowed per session** (e.g. artist may record a short burst at the start and another later)
- Screen stays awake during recording (`expo-keep-awake`)
- On Android: button is visible but tapping shows a brief tooltip — *"Time-lapse is available on iOS. Use video clips to capture your process."* — then opens standard video recording
- A small `TL` badge appears on time-lapse thumbnails in the media tray to distinguish them from regular video clips

#### 4. Video Clip (🎬)
- Tap → opens camera in video mode with a **"Record a clip now"** button
- Records up to **3 minutes** per clip
- A running time display and a stop button are shown during recording
- On stop → clip is saved and a thumbnail confirmation shown
- **Multiple clips per session allowed** — no limit
- Screen stays awake during recording (`expo-keep-awake`)

#### 5. Audio Note (🎙)
- Tap → starts recording immediately (no extra screen)
- A waveform animation appears in place of the toolbar, showing the live audio level
- Tap again → stops recording, saves the clip with a timestamp
- A brief confirmation toast: *"Audio note saved — 0:42"*
- Multiple audio notes per session allowed
- Audio recording continues if the screen sleeps (background audio session)

### Media tray (above toolbar)
- A horizontal scrollable strip showing thumbnails of everything captured this session
- Photos: JPEG thumbnail
- Video clips: thumbnail with a play icon + duration label
- Time-lapse clips: thumbnail with a play icon + `TL` badge + duration label
- Audio notes: waveform icon with duration label
- Text notes: small snippet card (first ~20 chars of the note)
- Tap any item → full-screen preview (read-only during active session)

### Session controls
- **"End Session"** button — shown as a subtle text link in the top bar or revealed via a long press on a dedicated area
- Tapping "End Session" → navigates to Check-out screen
- Reason for making End Session non-accidental: artist should not trigger it by mistake mid-flow

### Paused state
When the app returns from a background close and a draft session is detected:
- The screen loads in **paused state**
- Background animation is dimmed and static (not breathing)
- Timer shows the last recorded time, with a `PAUSED` label next to it
- A centred card overlay: *"Session paused"*, [Resume] [End & Review] buttons
- Tapping Resume → resumes timer and animation
- Tapping "End & Review" → navigates to Check-out with all draft content pre-loaded

### Screen sleep behaviour
| Scenario | Screen behaviour |
|---|---|
| Idle (no active capture) | Screen sleeps normally |
| Time-lapse recording active (iOS) | Screen stays awake — native camera is running |
| Video clip recording | Screen stays awake |
| Audio recording | Screen may sleep; audio continues via background audio session |
| Text note sheet open | Screen stays awake while sheet is visible |

---

## Screen 4 — Check-out (`app/session/checkout.tsx`)

**The closing ritual. Calm, reflective, unhurried.**

The artist reaches this screen by tapping "End Session" from the Active Session screen, or by tapping "End & Review" from the paused state overlay.

The background on this screen shifts to a **static, warm version** of the session's breathing palette — no animation, but the same colour warmth. A sense of stillness after movement.

### Layout (scrollable)

---

#### Section 1 — Session Summary
A soft strip at the top:
- Duration: `1h 23m`
- Photos: `7`
- Video clips: `2`
- Time-lapse clips: `1` *(shown only if at least one time-lapse was recorded)*
- Audio notes: `3`
- Text notes: `4`

---

#### Section 2 — Media Review

**Photos grid** (3 columns)
- Tap to preview full-screen
- Each photo has a small eye icon (public) or lock icon (private) — tap to toggle
- Default: private

**Video clips list**
- Each clip shows a thumbnail + duration label + timestamp within session
- Tap thumbnail → inline playback (muted autoplay preview, tap to unmute)
- Visibility toggle per clip

**Time-lapse clips list** *(shown only if any time-lapse was recorded)*
- Each entry shows a thumbnail + `TL` badge + duration label + timestamp
- Tap → inline playback (the `.mov` plays at native time-lapse speed — no extra processing)
- Visibility toggle per clip

**Audio notes list**
- Each entry: waveform icon + timestamp + duration
- Tap → inline playback with a progress bar
- Visibility toggle per note

---

#### Section 3 — Session Notes
- All text notes captured during the session, shown as cards in chronological order
- Each card is individually editable (tap to edit)
- Delete icon (swipe left or long press)

---

#### Section 4 — Add More
Label: *"Anything you want to add?"*
Three buttons in a row:
- **+ Photo** — opens camera or camera roll picker (can add multiple)
- **+ Audio note** — starts recording immediately
- **+ Text note** — opens text input sheet

Items added here are tagged internally as `post_session: true` but displayed in the same timeline.

---

#### Section 5 — Time-lapse Clips *(shown only if time-lapse recording was used this session)*
- Displayed as part of the Media Review section (Section 2), not a separate section
- Each time-lapse clip is a native `.mov` — it already plays as a finished time-lapse video
- No post-processing or speed controls needed at check-out
- The artist can trim or share these in a later phase; for now, save as-is

---

#### Section 6 — Reflection Note *(the check-out input)*
This section is visually distinct from the rest — slightly warmer background, larger text field.

- Label: *"How did this session feel?"*
- Subtext: *"Optional — just for you"*
- Large, open text area (no character limit)
- Placeholder: *"Write anything — what worked, what didn't, where you want to go next..."*
- This field is always private — no visibility toggle, no sharing
- The reflection note is saved as a special field on the session (`reflection_note`) not mixed in with in-session notes

---

#### Section 7 — Save / Discard (sticky footer)

Two buttons, always visible at the bottom:

- **"Save Session"** (primary, full width)
  - Saves everything, syncs to backend
  - Shows a brief saving indicator, then returns to Gallery
  - The project card in the Gallery updates to reflect the new session activity

- **"Discard Session"** (secondary, text link below)
  - Triggers a confirmation modal: *"This will permanently delete everything captured in this session. Are you sure?"*
  - [Cancel] [Yes, discard]
  - On confirm → deletes all local media and draft data, returns to Gallery

---

## Screen 5 — Project Create / Edit (`app/project/create.tsx` + `app/project/[id]/edit.tsx`)

A **bottom sheet modal** triggered from the Gallery (via "Add Art" or a project's edit option).

### Fields

**Project name**
- Text input, placeholder: *"Give it a name — or we'll call it "Untitled — [today's date]""*
- The placeholder auto-name format: `Untitled — March 16`
- Name is editable at any time

**Type**
- Two options as toggle pills: **In Progress** | **Finished**
- In Progress = active work; artist will run sessions against it
- Finished = documentation of a completed work; media can be uploaded but no live session timer

**Cover image** (optional)
- "Add a cover" — opens camera or photo picker
- Shown as a large thumbnail once set
- Can be changed at any time

**Save button**
- Creates / updates the project
- On create → returns to Gallery with the new card appearing at the top of the grid
- On edit → returns to wherever the modal was opened from

---

## Navigation Flow Diagram

```
[App open]
    ↓
[Auth check]
    ├── Not logged in → Login screen
    └── Logged in
            ↓
        [Gallery] ←──────────────────────────────────┐
            │                                         │
            ├── "Add Art" → [Project Create modal]   │
            │                                         │
            └── Tap project card                      │
                        ↓                             │
                [Session Start]                       │
                        ↓                             │
                [Active Session]                      │
                  (also resumed from paused draft)    │
                        ↓                             │
                  "End Session"                       │
                        ↓                             │
                [Check-out]                           │
                        ↓                             │
                 "Save Session" ─────────────────────┘
```

---

## Error & Empty States

| Screen | Empty state | Error state |
|---|---|---|
| Gallery | "Add Art" button, warm tagline | "Couldn't load your projects" + retry button |
| Session Start | n/a | "Couldn't start session" + retry |
| Active Session | n/a | Upload failure: silent retry in background; show badge on media item if sync fails |
| Check-out | n/a | "Couldn't save session — your work is stored locally" + retry button |

---

## Navigation Guards

- `app/_layout.tsx` checks `authStore` on load
- Unauthenticated users → redirect to `(auth)/login`
- If a draft session exists on app open → show paused banner on Gallery (do not auto-navigate to session — let the artist choose)
- The Check-out screen should not be accessible via back navigation from Gallery — once a session is saved, it's done
