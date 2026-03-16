# Data Model — Artwra

## Prisma Schema

Copy this into `apps/api/prisma/schema.prisma`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────

model User {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  supabaseId      String   @unique @map("supabase_id")
  email           String   @unique
  name            String
  username        String   @unique
  bio             String?
  avatarUrl       String?  @map("avatar_url")
  disciplines     String[] // e.g. ["painter", "sculptor"]
  isPublic        Boolean  @default(true) @map("is_public")
  pushToken       String?  @map("push_token")
  totalSessionsSec Int     @default(0) @map("total_sessions_sec")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Relations
  projects           Project[]
  checkinSessions    CheckinSession[]
  reactions          Reaction[]
  comments           Comment[]
  communityQuestions CommunityQuestion[]
  questionAnswers    QuestionAnswer[]
  notifications      Notification[]
  sentMessages       Message[]          @relation("SentMessages")
  receivedMessages   Message[]          @relation("ReceivedMessages")
  following          Follow[]           @relation("Follower")
  followers          Follow[]           @relation("Following")
  conversations      ConversationParticipant[]

  @@map("users")
}

// ─────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────

enum ProjectStatus {
  private
  in_progress
  finalized
}

model Project {
  id             String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId         String        @map("user_id") @db.Uuid
  title          String
  discipline     String        // e.g. "painting", "sculpture"
  description    String?
  coverImageUrl  String?       @map("cover_image_url")
  status         ProjectStatus @default(private)
  totalSessionsSec Int         @default(0) @map("total_sessions_sec")
  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")

  // Relations
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  checkinSessions CheckinSession[]
  reactions       Reaction[]
  comments        Comment[]
  questions       CommunityQuestion[]

  @@index([userId])
  @@index([status])
  @@map("projects")
}

// ─────────────────────────────────────────────
// CHECK-IN SESSIONS
// ─────────────────────────────────────────────

enum CaptureMode {
  free_capture   // Artist captures manually using any tool at will
  timelapse      // Session was started with time-lapse as the primary intent
                 // (does not auto-trigger anything — just signals artist preference)
}

model CheckinSession {
  id               String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId        String      @map("project_id") @db.Uuid
  userId           String      @map("user_id") @db.Uuid
  startedAt        DateTime    @map("started_at")
  endedAt          DateTime?   @map("ended_at")
  durationSec      Int?        @map("duration_sec")   // computed on wrap-up
  captureMode      CaptureMode @default(manual) @map("capture_mode")
  notes            String?     // text notes from the session
  isPublic         Boolean     @default(true) @map("is_public")
  isRetrospective  Boolean     @default(false) @map("is_retrospective")
  createdAt        DateTime    @default(now()) @map("created_at")
  updatedAt        DateTime    @updatedAt @map("updated_at")

  // Relations
  project  Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user     User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  media    CheckinMedia[]

  @@index([projectId])
  @@index([userId])
  @@map("checkin_sessions")
}

// ─────────────────────────────────────────────
// CHECK-IN MEDIA (photos + voice notes)
// ─────────────────────────────────────────────

enum MediaType {
  image       // Single photo (JPEG / HEIC)
  audio       // Voice note (M4A)
  video       // Short video clip, up to 3 min (MP4 / MOV)
  timelapse   // Native iOS time-lapse recording (MOV). Plays back as a finished
              // time-lapse video — no post-processing needed.
}

model CheckinMedia {
  id          String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sessionId   String      @map("session_id") @db.Uuid
  type        MediaType
  url         String      // Supabase Storage path (not full URL)
  timestamp   DateTime    @default(now())  // when within session it was captured
  isPublic    Boolean     @default(true) @map("is_public")
  durationSec Int?        @map("duration_sec") // for audio only
  createdAt   DateTime    @default(now()) @map("created_at")

  // Relations
  session CheckinSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@map("checkin_media")
}

// ─────────────────────────────────────────────
// REACTIONS
// ─────────────────────────────────────────────

enum ReactionType {
  thumbs_up
  inspired
  excited
  curious
}

model Reaction {
  id        String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId String       @map("project_id") @db.Uuid
  userId    String       @map("user_id") @db.Uuid
  type      ReactionType
  createdAt DateTime     @default(now()) @map("created_at")

  // Relations
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId]) // one reaction per user per project
  @@index([projectId])
  @@map("reactions")
}

// ─────────────────────────────────────────────
// COMMENTS
// ─────────────────────────────────────────────

model Comment {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId String   @map("project_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  content   String
  parentId  String?  @map("parent_id") @db.Uuid  // null = top-level, set = reply
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  project  Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent   Comment?  @relation("CommentReplies", fields: [parentId], references: [id])
  replies  Comment[] @relation("CommentReplies")

  @@index([projectId])
  @@index([parentId])
  @@map("comments")
}

// ─────────────────────────────────────────────
// COMMUNITY Q&A
// ─────────────────────────────────────────────

model CommunityQuestion {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId String   @map("project_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid  // the artist asking
  question  String
  isOpen    Boolean  @default(true) @map("is_open")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  project Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  answers QuestionAnswer[]

  @@index([projectId])
  @@map("community_questions")
}

model QuestionAnswer {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  questionId String   @map("question_id") @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  content    String
  createdAt  DateTime @default(now()) @map("created_at")

  // Relations
  question CommunityQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)
  user     User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([questionId])
  @@map("question_answers")
}

// ─────────────────────────────────────────────
// FOLLOWS
// ─────────────────────────────────────────────

model Follow {
  followerId  String   @map("follower_id") @db.Uuid
  followingId String   @map("following_id") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at")

  follower  User @relation("Follower", fields: [followerId], references: [id], onDelete: Cascade)
  following User @relation("Following", fields: [followingId], references: [id], onDelete: Cascade)

  @@id([followerId, followingId])
  @@index([followerId])
  @@index([followingId])
  @@map("follows")
}

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────

enum NotificationType {
  reaction
  comment
  qa_answer
  new_follower
  milestone
}

model Notification {
  id          String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String           @map("user_id") @db.Uuid  // recipient
  type        NotificationType
  referenceId String?          @map("reference_id")  // projectId, commentId, etc.
  actorId     String?          @map("actor_id") @db.Uuid  // who triggered it
  message     String
  isRead      Boolean          @default(false) @map("is_read")
  createdAt   DateTime         @default(now()) @map("created_at")

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([isRead])
  @@map("notifications")
}

// ─────────────────────────────────────────────
// DIRECT MESSAGES (text only, Phase 1)
// ─────────────────────────────────────────────

model Conversation {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  createdAt    DateTime @default(now()) @map("created_at")
  lastMessageAt DateTime? @map("last_message_at")

  // Relations
  participants ConversationParticipant[]
  messages     Message[]

  @@map("conversations")
}

model ConversationParticipant {
  conversationId String @map("conversation_id") @db.Uuid
  userId         String @map("user_id") @db.Uuid

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([conversationId, userId])
  @@map("conversation_participants")
}

model Message {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  conversationId String   @map("conversation_id") @db.Uuid
  senderId       String   @map("sender_id") @db.Uuid
  recipientId    String   @map("recipient_id") @db.Uuid
  content        String
  isRead         Boolean  @default(false) @map("is_read")
  createdAt      DateTime @default(now()) @map("created_at")

  // Relations
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       User         @relation("SentMessages", fields: [senderId], references: [id], onDelete: Cascade)
  recipient    User         @relation("ReceivedMessages", fields: [recipientId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@index([senderId])
  @@map("messages")
}
```

---

## Entity Relationship Notes

### User ↔ Project
One user owns many projects. Deleting a user cascades to all their projects and everything below.

### Project ↔ CheckinSession
One project has many sessions. Sessions represent individual work periods. A session can be retrospective (added after the fact).

### CheckinSession ↔ CheckinMedia
One session has many media items across four types: `image`, `audio`, `video`, and `timelapse`. Each item has its own `is_public` flag — an artist can keep specific items private even within a public session. Time-lapse items (`type = timelapse`) are native iOS `.mov` files and are treated the same as video in terms of storage and playback — distinguished only by the `type` field and a `TL` badge in the UI.

### Project ↔ Reaction
One reaction per user per project (enforced by `@@unique`). Changing a reaction means updating the existing row, not inserting a new one.

### Comment threading
`parent_id` is null for top-level comments and set to another comment's ID for replies. Only one level of threading is expected in Phase 1 (replies to top-level comments only — do not build infinite nesting).

### CommunityQuestion ↔ QuestionAnswer
The artist posts questions (`is_open = true`). Followers answer. The artist can close a question (`is_open = false`) to stop new answers.

### Follow (bidirectional)
`follower_id` follows `following_id`. To get "people I follow": `WHERE follower_id = me`. To get "my followers": `WHERE following_id = me`.

### Notification actor
`actor_id` is the user who triggered the notification (e.g., the person who reacted). `reference_id` is the ID of the resource the notification relates to (e.g., the project that received the reaction). Combine with `type` to deep-link correctly on the client.

---

## Indexes to Add for Performance

These are already in the schema above, but worth calling out:

- `users(username)` — username lookups
- `projects(user_id, status)` — fetching a user's public/in-progress projects
- `checkin_sessions(project_id)` — timeline view
- `checkin_media(session_id)` — session media gallery
- `reactions(project_id)` — aggregate reaction counts
- `comments(project_id, parent_id)` — threaded comment fetch
- `follows(follower_id), follows(following_id)` — feed and counts
- `notifications(user_id, is_read)` — unread count

---

## Computed / Derived Fields (not stored)

- **Follower count**: `COUNT(*) FROM follows WHERE following_id = user.id`
- **Following count**: `COUNT(*) FROM follows WHERE follower_id = user.id`
- **Reaction counts by type**: `GROUP BY type FROM reactions WHERE project_id = ?`
- **Total hours on profile**: `SUM(duration_sec) FROM checkin_sessions WHERE user_id = ?` (also cached in `users.total_sessions_sec` and updated on session wrap-up)
- **Session duration**: `ended_at - started_at` (stored in `duration_sec` on wrap-up)
