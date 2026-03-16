import { supabase } from '../lib/supabase';

const CHECKIN_MEDIA_BUCKET = 'checkin-media';
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CHECKIN_MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data) {
    throw Object.assign(
      new Error(`Failed to generate signed URL: ${error?.message ?? 'Unknown error'}`),
      { statusCode: 500, code: 'STORAGE_ERROR' }
    );
  }

  return data.signedUrl;
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(CHECKIN_MEDIA_BUCKET)
    .remove([path]);

  if (error) {
    throw Object.assign(
      new Error(`Failed to delete file: ${error.message}`),
      { statusCode: 500, code: 'STORAGE_ERROR' }
    );
  }
}

export async function getUploadUrl(
  bucket: string,
  filename: string,
  contentType: string
): Promise<{ uploadUrl: string; path: string }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(filename);

  if (error || !data) {
    throw Object.assign(
      new Error(`Failed to create upload URL: ${error?.message ?? 'Unknown error'}`),
      { statusCode: 500, code: 'STORAGE_ERROR' }
    );
  }

  return {
    uploadUrl: data.signedUrl,
    path: data.path,
  };
}
