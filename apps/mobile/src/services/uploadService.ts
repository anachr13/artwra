import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import api from '../lib/api';
import { useSessionStore, MediaItem } from '../stores/sessionStore';

function getExtension(type: MediaItem['type'], localPath: string): string {
  // derive from localPath or default per type
  const ext = localPath.split('.').pop()?.toLowerCase();
  if (ext && ['jpg', 'jpeg', 'heic', 'mp4', 'mov', 'm4a'].includes(ext)) return ext;
  const defaults: Record<string, string> = { photo: 'jpg', video: 'mp4', timelapse: 'mov', audio: 'm4a', text_note: '' };
  return defaults[type] || 'bin';
}

async function uploadWithRetry(item: MediaItem, userId: string, sessionId: string, retries = 3): Promise<void> {
  if (!item.localPath) return; // text_notes have no file

  const store = useSessionStore.getState();
  store.updateMediaSyncStatus(item.id, 'uploading');

  const ext = getExtension(item.type, item.localPath);
  const storagePath = `${userId}/${sessionId}/${item.id}.${ext}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(item.localPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Uint8Array
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const contentTypeMap: Record<string, string> = {
        photo: 'image/jpeg',
        video: 'video/mp4',
        timelapse: 'video/quicktime',
        audio: 'audio/mp4',
      };

      const { error } = await supabase.storage
        .from('checkin-media')
        .upload(storagePath, bytes, {
          contentType: contentTypeMap[item.type] || 'application/octet-stream',
          upsert: false,
        });

      if (error) throw error;

      // Create DB record
      await api.post('/media', {
        sessionId,
        type: item.type === 'photo' ? 'image' : item.type,
        url: storagePath,
        durationSec: item.duration,
        timestampInSession: item.timestampInSession,
        isPublic: item.isPublic,
      });

      // Mark synced
      useSessionStore.getState().updateMediaSyncStatus(item.id, 'synced', storagePath);
      return;

    } catch (err) {
      if (attempt < retries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // All retries exhausted
  useSessionStore.getState().updateMediaSyncStatus(item.id, 'failed');
}

export function triggerUpload(item: MediaItem, userId: string, sessionId: string): void {
  if (item.type === 'text_note') return; // no file to upload
  if (item.syncStatus === 'synced' || item.syncStatus === 'uploading') return;
  uploadWithRetry(item, userId, sessionId).catch(() => {
    useSessionStore.getState().updateMediaSyncStatus(item.id, 'failed');
  });
}

export async function uploadAllPending(userId: string, sessionId: string): Promise<void> {
  const { media } = useSessionStore.getState();
  const pending = media.filter(m => m.syncStatus === 'pending' || m.syncStatus === 'failed');
  await Promise.allSettled(pending.map(item => uploadWithRetry(item, userId, sessionId)));
}
