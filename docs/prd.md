# Artwra — Product Requirements Document (Phase 1)

**Version:** 1.3 Draft
**Platform:** iOS + Android (React Native)
**Status:** Draft — Focused build: Creative Check-in Session

---

## 1. Overview

Artwra is a mobile app for visual artists to document, track, and share their creative work. The entire product is built around one core interaction: the **creative check-in session** — a structured, immersive space for the artist to be present with their work while the app quietly captures their progress.

Phase 1 ships one feature done exceptionally well: the end-to-end session experience, from opening the gallery to checking out with a reflection at the end.

---

## 2. Problem Statement

Artists have no dedicated space to document their creative progress in a structured way. Existing tools are either too generic (camera roll, notes apps) or too social-first (Instagram). Artwra gives the artist a calm, focused container to work in — one that gets out of the way during the creative act but captures everything meaningful.

---

## 3. Target Users

**Primary — the active visual creator:** A visual artist working on up to ~5 projects simultaneously. Wants to document progress without interrupting flow. Values calm UI, privacy control, and the ability to revisit the story of a piece.

**Secondary — the engaged follower:** Someone who follows specific artists and wants to see work-in-progress unfold. (Community/social features are scoped to a later phase.)

---

## 4. Core User Flow — Phase 1

```
Open app
  → Gallery screen (first screen)
  → Tap project  OR  tap "Add Art"
  → Session start (new or existing project)
  → Active session (timer + capture tools)
  → Session end
  → Check-out screen (reflection + final additions)
  → Session saved → returns to Gallery
```

---

## 5. Feature Specification

### 5.1 Gallery Screen (Entry Point)

The Gallery is the home screen. It shows the artist's own projects — works in progress and finished pieces.

**Empty state:**
When the artist has no projects, the screen shows a single prominent button: **"Add Art"**. No other clutter. The button can initiate either a finished work (upload existing photos) or a new in-progress piece.

**Populated state:**
Projects displayed as a visual grid with cover images. Expected ~5 open projects at a time, so layout should feel curated, not crowded. Each card shows:
- Cover image (or placeholder if none yet)
- Project name
- Status indicator (In Progress / Finished)
- Last active date

Tapping a project goes directly into the session start screen for that project.

---

### 5.2 Project Creation

Triggered from the Gallery via "Add Art" or from the session start screen when the artist wants to begin work on something new.

**Name:**
The artist can type a project name, or skip it entirely. If skipped, the system auto-assigns a placeholder in the format: **"Untitled — [Month Day]"** (e.g. "Untitled — March 16"). The artist can rename at any time.

**Type:**
Two options — In Progress (they're actively working on it) or Finished (uploading documentation of a completed work).

**Cover image:**
Optional at creation. Can be added or changed later from the gallery or check-out screen.

---

### 5.3 Session Start

Before the session begins, the artist confirms:
- Which project this session is for (pre-selected if they tapped from a project card)
- Capture mode (see 5.4.4)

A minimal, calm start screen — no overwhelming options. One clear **"Begin Session"** button.

---

### 5.4 Active Session Screen

This is the heart of the product. The screen should feel like a creative sanctuary — calm, focused, and alive.

#### 5.4.1 Background Animation

A **subtle breathing pulse** fills the screen behind all UI elements. The animation is:
- Slow, organic, and rhythmic — expanding and contracting like breath
- Colour palette: warm, painterly tones that shift very gradually (not distracting)
- Never sharp or mechanical — this should reinforce the feeling of creative flow, not urgency
- Implemented as a looping animated gradient or particle-based texture using React Native Reanimated or Lottie

The animation does **not** pause when the screen sleeps. It resumes exactly where it was when the artist returns.

#### 5.4.2 Session Timer

- Always visible on the active session screen
- Visually soft: small size, low opacity, positioned in a non-intrusive corner
- Format: `HH:MM:SS`
- The timer runs in the background via a registered background task (`expo-task-manager`). It continues counting even when the app is backgrounded or the screen sleeps.
- **Screen sleep behaviour:** The screen is allowed to sleep normally during a session to preserve battery — except when Time-lapse mode or Video recording is actively running, in which case the screen must stay awake (`expo-keep-awake`).

#### 5.4.3 Capture Tools

All tools are available as a persistent bottom action bar during the session. The artist can use any combination at any point.

| Tool | Description |
|---|---|
| **Photo** | Single photo capture via the device camera |
| **Time-lapse** | Activates the **native iOS Time-lapse camera mode** via `react-native-vision-camera`. The camera records a time-lapse video directly — the OS handles frame rate adaptation. The artist points the camera at their work and the device captures the video natively. Output is a single `.mov` file saved locally and synced to Supabase Storage. Multiple time-lapse recordings are allowed per session. Screen stays awake during recording. **Android note:** Android does not have an equivalent native time-lapse camera mode. On Android, this button opens standard video recording with a note that time-lapse is iOS only in Phase 1. |
| **Video clip** | Record a short video clip, up to 3 minutes per clip. Multiple clips are allowed per session. Each clip is labelled with the time it was taken within the session. The action is triggered by a **"Record a clip now"** button. |
| **Audio note** | Record a voice memo. The artist taps to start and taps again to stop. Waveform shown while recording. Playback available inline during the session. Multiple audio notes per session allowed. |
| **Text note** | Expandable text input. Timestamped when saved. Multiple text notes per session allowed. |

All captured media is stored locally and synced to Supabase Storage in the background. The artist does not need to wait for upload before continuing.

#### 5.4.4 Session Draft & Recovery

If the artist closes the app mid-session (accidentally or intentionally), the session is **automatically paused and saved as a draft**. All captured media and notes are preserved locally.

When the artist reopens the app:
- They are taken directly to the **Session screen**, not the Gallery
- The session is shown in a **paused state** with a clear indicator ("Session paused — tap to resume")
- The artist can choose to **resume** or **end the session** and proceed to Check-out

Draft state is persisted using a combination of Zustand + AsyncStorage so it survives app restarts and device reboots.

---

### 5.5 Check-out Screen

The Check-out screen is a distinct, calmer screen the artist reaches when they choose to end a session. It serves two purposes: **reviewing what was captured** and **adding a final reflection**.

This screen should feel like closing a journal — thoughtful, not rushed.

**Sections:**

1. **Session summary strip**
   - Total time, photo count, video clip count, audio note count

2. **Media review**
   - Scrollable grid of all photos taken this session
   - Tap to preview full screen
   - Each item has a visibility toggle (public / private) — defaults to private

3. **Video clips**
   - List of recorded clips with duration labels
   - Tap to preview
   - Visibility toggle per clip

4. **Audio notes**
   - List of recordings with timestamps
   - Inline playback
   - Visibility toggle per clip

5. **Session notes**
   - All text notes captured during the session, shown in order
   - Each is individually editable

6. **Add more**
   - The artist can add additional photos (from camera or camera roll), audio notes, or text notes at this point. These are tagged as post-session additions.

7. **Reflection note** *(the check-out input)*
   - A dedicated, distinct text field — larger, warmer visually — labelled something like *"How did this session feel?"* or *"End of session thoughts"*
   - This is separate from in-session notes. It's the artist's closing reflection on the whole session.
   - Optional. Can be left blank.

8. **Time-lapse clips** *(shown only if time-lapse recording was used this session)*
   - Listed alongside video clips — each time-lapse clip shows a thumbnail, duration label, and a `TL` badge to distinguish it from regular video clips
   - Tap → inline playback (the `.mov` file plays back as recorded — native iOS time-lapse already plays at the correct speed)
   - Visibility toggle per clip

9. **Save session**
   - Saves and syncs everything
   - Returns the artist to the Gallery, where the updated project card reflects the new activity

10. **Discard session**
    - Confirm dialog. Permanently deletes all captured media for this session.

---

### 5.6 Project Privacy

Each session, and each piece of media within it, has an individual **public/private** toggle. Default is **private** for everything.

The artist decides what to share and when — never pressured. The app does not push for sharing.

---

## 6. Screens Summary

| Screen | Role |
|---|---|
| Gallery | App entry point. Artist's projects. Empty state with "Add Art". |
| Session Start | Confirm project + capture mode. Calm, minimal. |
| Active Session | Timer, breathing pulse bg, full capture toolbar. |
| Check-out | Review + reflect + save. Closing ritual for the session. |
| Project Create/Edit | Name, type, cover image. Lightweight modal. |

---

## 7. Media Types Supported (Phase 1)

| Type | Format | Limit | Platform |
|---|---|---|---|
| Photos | JPEG / HEIC | Unlimited per session | iOS + Android |
| Time-lapse clips | MOV (native iOS time-lapse) | Unlimited per session | iOS only (Phase 1) |
| Video clips | MP4 / MOV | Up to 3 min per clip, unlimited clips | iOS + Android |
| Audio notes | M4A | Unlimited per session | iOS + Android |
| Text notes | Plain text | Unlimited per session | iOS + Android |
| Reflection note | Plain text | 1 per session (check-out only) | iOS + Android |

---

## 8. Data Persistence & Sync

- All session data is saved **locally first** (AsyncStorage + file system)
- Background sync to Supabase Storage happens automatically
- If the artist is offline, the session saves fully locally and syncs when connectivity returns
- A session is not considered "lost" until the artist explicitly discards it

---

## 9. Performance & Battery Considerations

| Scenario | Behaviour |
|---|---|
| Idle session (no active capture) | Screen sleeps normally. Timer continues in background. |
| Time-lapse recording active (iOS) | Screen stays awake (`expo-keep-awake`). Native camera handles frame capture. |
| Video recording active | Screen stays awake (`expo-keep-awake`) |
| Audio recording active | Screen may sleep; audio continues via background audio session |
| App backgrounded mid-session | Session pauses and saves draft. Timer suspends. |

---

## 10. Out of Scope — Phase 1

- Community feed, reactions, comments
- Follow system
- Social export / promotional templates
- Push notifications
- Direct messages
- Web app
- Real-time collaboration
- Paid features or marketplace
- AI suggestions
- Analytics dashboard

---

## 11. Success Metrics

| Metric | Target |
|---|---|
| Session completion rate (started → saved) | > 70% |
| Average session duration | > 30 minutes |
| Media items captured per session | ≥ 3 |
| Return sessions on same project | ≥ 2 sessions per project |
| Check-out reflection completion rate | > 50% of saved sessions include a reflection note |
