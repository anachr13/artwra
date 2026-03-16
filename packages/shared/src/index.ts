// Schemas
export * from './schemas/auth';
export * from './schemas/project';
export * from './schemas/session';

// Types
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  username: string;
  disciplines: string[];
  avatarUrl?: string;
  bio?: string;
  isPublic: boolean;
  totalSessionsSec: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId: string;
  title: string;
  discipline: string;
  description?: string;
  coverImageUrl?: string;
  status: 'private' | 'in_progress' | 'finalized';
  totalSessionsSec: number;
  lastSessionAt?: string | null;
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CheckinSession {
  id: string;
  projectId: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  captureMode: 'free_capture' | 'timelapse';
  reflectionNote?: string;
  isDraft: boolean;
  isPublic: boolean;
  media: CheckinMedia[];
  createdAt: string;
}

export interface CheckinMedia {
  id: string;
  sessionId: string;
  type: 'image' | 'audio' | 'video' | 'timelapse';
  url: string;
  timestamp: string;
  isPublic: boolean;
  durationSec?: number;
  timestampInSession?: number;
}
