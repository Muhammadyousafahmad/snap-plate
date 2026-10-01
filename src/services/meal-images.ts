import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { getSupabase } from '@/services/supabase';

const BUCKET = 'meal-images';
const SIGNED_URL_TTL_SECONDS = 15 * 60;

async function readImageUploadBody(imageUri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const response = await fetch(imageUri);
    if (!response.ok) throw new Error(`Could not read image (${response.status}).`);
    return response.arrayBuffer();
  }

  // Supabase recommends ArrayBuffer for React Native uploads. Blob, File and
  // FormData are not reliably serialized by the client on every native runtime.
  return new File(imageUri).arrayBuffer();
}

export async function uploadMealImage(
  userId: string,
  scanId: string,
  imageUri: string,
): Promise<string> {
  const body = await readImageUploadBody(imageUri);
  const path = `${userId}/${scanId}.jpg`;
  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function createMealImageUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  try {
    const { data, error } = await getSupabase()
      .storage.from(BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error || !Array.isArray(data)) return {};

    const urls: Record<string, string> = {};
    for (const value of data) {
      if (
        value &&
        typeof value === 'object' &&
        'path' in value &&
        'signedUrl' in value &&
        typeof value.path === 'string' &&
        typeof value.signedUrl === 'string'
      ) {
        urls[value.path] = value.signedUrl;
      }
    }
    return urls;
  } catch {
    return {};
  }
}

export async function deleteMealImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await getSupabase().storage.from(BUCKET).remove(paths);
  } catch {
    // Metadata deletion should still proceed if Storage is temporarily offline.
  }
}
