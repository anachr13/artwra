import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

export interface MediaItem {
  id: string;
  type: 'photo' | 'video' | 'timelapse' | 'audio' | 'text_note';
  localPath?: string;
  content?: string;
  duration?: number;
  timestampInSession: number;
  syncStatus: 'pending' | 'uploading' | 'synced' | 'failed';
  remoteUrl?: string;
  isPublic: boolean;
  postSession: boolean;
}

interface SessionState {
  sessionId: string | null;
  projectId: string | null;
  projectName: string | null;
  captureMode: 'free_capture' | 'timelapse';
  startedAt: string | null;
  elapsedSeconds: number;
  isPaused: boolean;
  isDraft: boolean;
  media: MediaItem[];
  reflectionNote: string;

  startSession: (
    projectId: string,
    projectName: string,
    captureMode: 'free_capture' | 'timelapse',
    sessionId: string
  ) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  addMedia: (
    item: Omit<MediaItem, 'id' | 'syncStatus' | 'isPublic' | 'postSession'> & {
      postSession?: boolean;
    }
  ) => string;
  updateMediaSyncStatus: (
    id: string,
    status: MediaItem['syncStatus'],
    remoteUrl?: string
  ) => void;
  updateMediaVisibility: (id: string, isPublic: boolean) => void;
  removeMedia: (id: string) => void;
  updateTextNote: (id: string, content: string) => void;
  setReflectionNote: (note: string) => void;
  tickTimer: () => void;
  discardSession: () => Promise<void>;
  clearSession: () => void;
  setSessionId: (id: string) => void;
}

function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 9) +
    Math.random().toString(36).substring(2, 9)
  );
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      projectId: null,
      projectName: null,
      captureMode: 'free_capture',
      startedAt: null,
      elapsedSeconds: 0,
      isPaused: false,
      isDraft: false,
      media: [],
      reflectionNote: '',

      startSession: (projectId, projectName, captureMode, sessionId) => {
        set({
          sessionId,
          projectId,
          projectName,
          captureMode,
          startedAt: new Date().toISOString(),
          elapsedSeconds: 0,
          isPaused: false,
          isDraft: true,
          media: [],
          reflectionNote: '',
        });
      },

      pauseSession: () => {
        set({ isPaused: true });
      },

      resumeSession: () => {
        set({ isPaused: false });
      },

      addMedia: (item) => {
        const id = generateId();
        const newItem: MediaItem = {
          ...item,
          id,
          syncStatus: 'pending',
          isPublic: false,
          postSession: item.postSession ?? false,
        };
        set((state) => ({ media: [...state.media, newItem] }));
        return id;
      },

      updateMediaSyncStatus: (id, status, remoteUrl) => {
        set((state) => ({
          media: state.media.map((m) =>
            m.id === id
              ? { ...m, syncStatus: status, ...(remoteUrl && { remoteUrl }) }
              : m
          ),
        }));
      },

      updateMediaVisibility: (id, isPublic) => {
        set((state) => ({
          media: state.media.map((m) =>
            m.id === id ? { ...m, isPublic } : m
          ),
        }));
      },

      removeMedia: (id) => {
        const item = get().media.find((m) => m.id === id);
        if (item?.localPath) {
          FileSystem.deleteAsync(item.localPath, { idempotent: true }).catch(
            (err: Error) => console.warn('Failed to delete media file:', err.message)
          );
        }
        set((state) => ({
          media: state.media.filter((m) => m.id !== id),
        }));
      },

      updateTextNote: (id, content) => {
        set((state) => ({
          media: state.media.map((m) =>
            m.id === id ? { ...m, content } : m
          ),
        }));
      },

      setReflectionNote: (note) => {
        set({ reflectionNote: note });
      },

      tickTimer: () => {
        const { isPaused } = get();
        if (!isPaused) {
          set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
        }
      },

      discardSession: async () => {
        const { media } = get();

        // Delete all local files
        const deletePromises = media
          .filter((m) => m.localPath)
          .map((m) =>
            FileSystem.deleteAsync(m.localPath!, { idempotent: true }).catch(
              (err: Error) =>
                console.warn('Failed to delete file:', err.message)
            )
          );

        await Promise.all(deletePromises);

        set({
          sessionId: null,
          projectId: null,
          projectName: null,
          captureMode: 'free_capture',
          startedAt: null,
          elapsedSeconds: 0,
          isPaused: false,
          isDraft: false,
          media: [],
          reflectionNote: '',
        });
      },

      clearSession: () => {
        set({
          sessionId: null,
          projectId: null,
          projectName: null,
          captureMode: 'free_capture',
          startedAt: null,
          elapsedSeconds: 0,
          isPaused: false,
          isDraft: false,
          media: [],
          reflectionNote: '',
        });
      },

      setSessionId: (id) => {
        set({ sessionId: id });
      },
    }),
    {
      name: 'artwra-session',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
