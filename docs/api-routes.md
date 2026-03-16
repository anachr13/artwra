# API Routes — Artwra

Base path: `/api/v1`
Auth header: `Authorization: Bearer <supabase_jwt>` (required on all routes marked 🔒)
Response envelope: `{ data: T | null, error: { message: string, code: string } | null }`
Pagination: cursor-based `?cursor=<uuid>&limit=20` (default limit 20, max 100)

---

## Auth / Users

### `POST /auth/sync` 🔒
Called immediately after Supabase sign-up to create the user record in the app DB.

**Body:**
```json
{
  "name": "string",
  "username": "string",
  "disciplines": ["string"]
}
```
**Response:** `User`

---

### `GET /users/me` 🔒
Returns the authenticated user's full profile including stats.

**Response:** `User & { followersCount: number, followingCount: number, totalHoursBadge: string }`

---

### `PATCH /users/me` 🔒
Update own profile fields.

**Body (all optional):**
```json
{
  "name": "string",
  "username": "string",
  "bio": "string",
  "avatarUrl": "string",
  "disciplines": ["string"],
  "isPublic": true,
  "pushToken": "string"
}
```
**Response:** `User`

---

### `GET /users/:id`
Get a public user profile. Returns 404 if user is private and requesting user doesn't follow them.

**Response:** `User & { followersCount, followingCount, isFollowing: boolean }`

---

### `GET /users/me/projects` 🔒
Get own projects (all statuses).

**Query params:** `?status=private|in_progress|finalized&cursor=&limit=`
**Response:** `{ projects: Project[], nextCursor: string | null }`

---

### `GET /users/:id/projects`
Get another user's public projects.

**Query params:** `?status=in_progress|finalized&cursor=&limit=`
**Response:** `{ projects: Project[], nextCursor: string | null }`

---

### `GET /users/suggested` 🔒
Returns users to discover (not currently followed, ordered by follower count).

**Query params:** `?cursor=&limit=`
**Response:** `{ users: User[], nextCursor: string | null }`

---

## Projects

### `POST /projects` 🔒
Create a new project.

**Body:**
```json
{
  "title": "string",
  "discipline": "string",
  "description": "string | null",
  "coverImageUrl": "string | null",
  "status": "private | in_progress"
}
```
**Response:** `Project` (201)

---

### `GET /projects/:id`
Get a single project. Returns 403 if private and requester is not owner.

**Response:** `Project & { sessionCount, totalHours, reactionCounts: Record<ReactionType, number>, userReaction: ReactionType | null, isOwner: boolean }`

---

### `PATCH /projects/:id` 🔒
Update a project. Only the owner can update.

**Body (all optional):**
```json
{
  "title": "string",
  "discipline": "string",
  "description": "string",
  "coverImageUrl": "string",
  "status": "private | in_progress | finalized"
}
```
**Note:** Status can only move forward (private → in_progress → finalized). Reject backward transitions with 422.
**Response:** `Project`

---

### `DELETE /projects/:id` 🔒
Delete a project and all its sessions and media. Only owner.

**Response:** `{ success: true }` (200)

---

### `GET /projects/public`
Get all public (in_progress or finalized) projects for the gallery.

**Query params:** `?discipline=&sort=recent|reactions|activity&cursor=&limit=`
**Response:** `{ projects: Project[], nextCursor: string | null }`

---

### `GET /projects/trending`
Projects with most reactions + activity in the last 7 days.

**Query params:** `?cursor=&limit=`
**Response:** `{ projects: Project[], nextCursor: string | null }`

---

## Check-in Sessions

### `POST /sessions` 🔒
Start a new session OR save a retrospective check-in.

**Body:**
```json
{
  "projectId": "uuid",
  "startedAt": "ISO8601",
  "endedAt": "ISO8601 | null",
  "durationSec": "number | null",
  "captureMode": "manual | auto_5min | auto_10min | auto_30min",
  "notes": "string | null",
  "isPublic": true,
  "isRetrospective": false
}
```
**Response:** `CheckinSession` (201)

---

### `PATCH /sessions/:id` 🔒
Wrap up a session (add endedAt, durationSec, notes) or update any field.

**Body (all optional):**
```json
{
  "endedAt": "ISO8601",
  "durationSec": 3600,
  "notes": "string",
  "isPublic": true
}
```
**Response:** `CheckinSession`

---

### `DELETE /sessions/:id` 🔒
Delete a session and all its media. Owner only.

**Response:** `{ success: true }`

---

### `GET /projects/:projectId/sessions`
Get all sessions for a project, newest first.

**Query params:** `?cursor=&limit=`
**Access:** Private sessions only visible to owner.
**Response:** `{ sessions: (CheckinSession & { media: CheckinMedia[] })[], nextCursor: string | null }`

---

## Media

### `POST /sessions/:sessionId/media` 🔒
Upload a signed upload URL request. Client uploads to Supabase Storage directly, then calls this to register the media record.

**Body:**
```json
{
  "type": "image | audio",
  "url": "storage path string",
  "timestamp": "ISO8601",
  "isPublic": true,
  "durationSec": null
}
```
**Response:** `CheckinMedia` (201)

---

### `PATCH /media/:id` 🔒
Update media visibility.

**Body:**
```json
{ "isPublic": false }
```
**Response:** `CheckinMedia`

---

### `DELETE /media/:id` 🔒
Delete a media item and remove from Supabase Storage.

**Response:** `{ success: true }`

---

### `GET /media/signed-url` 🔒
Get a signed URL for accessing a private media item.

**Query params:** `?path=<storage path>`
**Response:** `{ signedUrl: string, expiresAt: string }`

---

### `POST /media/upload-url` 🔒
Get a pre-signed upload URL from Supabase Storage (so client uploads directly).

**Body:**
```json
{
  "bucket": "checkin-media | project-covers",
  "filename": "string",
  "contentType": "image/jpeg | audio/m4a | ..."
}
```
**Response:** `{ uploadUrl: string, path: string }`

---

## Reactions

### `POST /projects/:projectId/reactions` 🔒
Add or update a reaction. If user already has a reaction, update it.

**Body:**
```json
{ "type": "thumbs_up | inspired | excited | curious" }
```
**Response:** `Reaction` (201)

---

### `DELETE /projects/:projectId/reactions` 🔒
Remove the authenticated user's reaction from a project.

**Response:** `{ success: true }`

---

## Comments

### `GET /projects/:projectId/comments`
Get top-level comments + first 2 replies for each.

**Query params:** `?cursor=&limit=`
**Response:** `{ comments: (Comment & { author: User, replyCount: number, replies: Comment[] })[], nextCursor }`

---

### `GET /comments/:commentId/replies`
Get all replies for a comment.

**Query params:** `?cursor=&limit=`
**Response:** `{ replies: (Comment & { author: User })[], nextCursor }`

---

### `POST /projects/:projectId/comments` 🔒
Post a comment or reply.

**Body:**
```json
{
  "content": "string",
  "parentId": "uuid | null"
}
```
**Response:** `Comment & { author: User }` (201)

---

### `DELETE /comments/:id` 🔒
Delete own comment (or any comment if admin — not in Phase 1).

**Response:** `{ success: true }`

---

## Community Q&A

### `POST /projects/:projectId/questions` 🔒
Artist posts a question about their project.

**Body:**
```json
{ "question": "string" }
```
**Response:** `CommunityQuestion` (201)

---

### `GET /projects/:projectId/questions`
Get all questions for a project.

**Response:** `{ questions: (CommunityQuestion & { answerCount: number, topAnswers: QuestionAnswer[] })[] }`

---

### `POST /questions/:id/answers` 🔒
A follower answers a question.

**Body:**
```json
{ "content": "string" }
```
**Response:** `QuestionAnswer` (201)

---

### `GET /questions/:id/answers`
Get all answers to a question.

**Query params:** `?cursor=&limit=`
**Response:** `{ answers: (QuestionAnswer & { author: User })[], nextCursor }`

---

### `PATCH /questions/:id` 🔒
Artist closes a question (`isOpen: false`). Owner only.

**Body:**
```json
{ "isOpen": false }
```
**Response:** `CommunityQuestion`

---

## Follows

### `POST /users/:id/follow` 🔒
Follow a user.

**Response:** `{ success: true }` (201)

---

### `DELETE /users/:id/follow` 🔒
Unfollow a user.

**Response:** `{ success: true }`

---

### `GET /users/:id/followers`
Get follower list for a user.

**Query params:** `?cursor=&limit=`
**Response:** `{ users: User[], nextCursor }`

---

### `GET /users/:id/following`
Get who a user follows.

**Query params:** `?cursor=&limit=`
**Response:** `{ users: User[], nextCursor }`

---

## Feed

### `GET /feed/activity` 🔒
Activity from artists the current user follows. Sorted newest first.

**Query params:** `?cursor=&limit=`
**Response:**
```json
{
  "events": [
    {
      "type": "new_session | new_question | reaction_milestone",
      "actor": "User",
      "project": "Project",
      "session": "CheckinSession | null",
      "question": "CommunityQuestion | null",
      "occurredAt": "ISO8601"
    }
  ],
  "nextCursor": "string | null"
}
```

---

### `GET /feed/following` 🔒
Alias for `GET /feed/activity` — same response.

---

## Notifications

### `GET /notifications` 🔒
Get all notifications for the current user.

**Query params:** `?cursor=&limit=&unreadOnly=true`
**Response:** `{ notifications: Notification[], unreadCount: number, nextCursor }`

---

### `PATCH /notifications/read-all` 🔒
Mark all notifications as read.

**Response:** `{ success: true }`

---

### `PATCH /notifications/:id/read` 🔒
Mark a single notification as read.

**Response:** `Notification`

---

## Messages

### `GET /conversations` 🔒
Get the current user's conversations.

**Query params:** `?cursor=&limit=`
**Response:** `{ conversations: (Conversation & { otherParticipant: User, lastMessage: Message | null, unreadCount: number })[], nextCursor }`

---

### `POST /conversations` 🔒
Start a new conversation (or return existing one with that user).

**Body:**
```json
{ "recipientId": "uuid" }
```
**Response:** `Conversation & { otherParticipant: User }` (201 or 200 if existing)

---

### `GET /conversations/:id/messages` 🔒
Get messages in a conversation.

**Query params:** `?cursor=&limit=`
**Response:** `{ messages: (Message & { sender: User })[], nextCursor }`

---

### `POST /conversations/:id/messages` 🔒
Send a message.

**Body:**
```json
{ "content": "string" }
```
**Response:** `Message & { sender: User }` (201)

---

## Export

### `GET /export/:projectId` 🔒
Get all public media for a project, ordered chronologically, for export assembly.

**Response:**
```json
{
  "project": "Project",
  "media": [
    {
      "id": "uuid",
      "type": "image",
      "signedUrl": "string",
      "timestamp": "ISO8601",
      "sessionId": "uuid"
    }
  ],
  "sessionNotes": [
    {
      "sessionId": "uuid",
      "notes": "string",
      "sessionDate": "ISO8601"
    }
  ]
}
```
**Note:** Assembly happens on-device. This endpoint just provides signed URLs and note content.

---

## Error Codes Reference

| Code | Meaning |
|---|---|
| `UNAUTHORIZED` | Missing or invalid JWT |
| `FORBIDDEN` | Authenticated but not allowed |
| `NOT_FOUND` | Resource doesn't exist |
| `VALIDATION_ERROR` | Zod validation failed (includes field errors) |
| `DUPLICATE` | Unique constraint violation |
| `INVALID_TRANSITION` | Attempted invalid status transition |
| `STORAGE_ERROR` | Supabase Storage operation failed |
| `PUSH_ERROR` | Push notification delivery failed (non-fatal) |

---

## Internal Notification Triggers

These are fired **within the API** (not client-callable), by `notificationService.ts`, after the following events:

| Event | Notification type | Recipient |
|---|---|---|
| Someone reacts to a project | `reaction` | Project owner |
| Someone comments on a project | `comment` | Project owner |
| Someone answers an artist's question | `qa_answer` | Question author |
| Someone follows a user | `new_follower` | Followed user |
| Session brings project total to 5h / 10h / 25h / 50h | `milestone` | Project owner |
