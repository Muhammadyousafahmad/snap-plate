import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NutritionItem, NutritionResult } from '@/services/ai';
import { createMealImageUrls, deleteMealImages, uploadMealImage } from '@/services/meal-images';
import { getSupabase } from '@/services/supabase';

const HISTORY_KEY_PREFIX = 'snapplate.history.v2';
const DEVICE_HISTORY_KEY = `${HISTORY_KEY_PREFIX}.device`;
const MAX_ENTRIES = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface HistoryEntry {
  id: string;
  scanned_at: string;
  /** Name the user picked when saving this meal (asked at save time). */
  meal_name?: string;
  result: NutritionResult;
  image_path?: string;
  image_url?: string;
  image_uri?: string;
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function historyKey(userId: string | null): string {
  return userId ? `${HISTORY_KEY_PREFIX}.${userId}` : DEVICE_HISTORY_KEY;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<HistoryEntry>;
  if (typeof entry.id !== 'string' || typeof entry.scanned_at !== 'string') return false;
  const result = entry.result as NutritionResult | undefined;
  return !!result && typeof result === 'object' && Array.isArray(result.items_detected);
}

function parseLocalEntries(raw: string | null): HistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isHistoryEntry) : [];
  } catch {
    return [];
  }
}

async function readLocalHistory(key: string): Promise<HistoryEntry[]> {
  try {
    return parseLocalEntries(await AsyncStorage.getItem(key));
  } catch {
    return [];
  }
}

async function writeLocalHistory(key: string, entries: HistoryEntry[]): Promise<void> {
  try {
    const cacheEntries = entries.slice(0, MAX_ENTRIES).map(({ image_url: _signedUrl, ...entry }) => entry);
    await AsyncStorage.setItem(key, JSON.stringify(cacheEntries));
  } catch {
    // Cloud persistence remains available when the local cache cannot be written.
  }
}

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const { data, error } = await getSupabase().auth.getUser();
    return error ? null : data.user.id;
  } catch {
    return null;
  }
}

function mapCloudItem(value: unknown): NutritionItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.name !== 'string' || !item.name.trim()) return null;

  const originalGrams =
    item.original_grams === null || item.original_grams === undefined
      ? undefined
      : toNumber(item.original_grams);

  return {
    name: item.name,
    portion: typeof item.portion === 'string' ? item.portion : '',
    calories: toNumber(item.calories),
    protein_g: toNumber(item.protein_g),
    carbs_g: toNumber(item.carbs_g),
    fat_g: toNumber(item.fat_g),
    ...(originalGrams && originalGrams > 0 ? { original_grams: originalGrams } : {}),
    ...(item.calories_per_100g !== null && item.calories_per_100g !== undefined
      ? { calories_per_100g: toNumber(item.calories_per_100g) }
      : {}),
    ...(item.protein_per_100g !== null && item.protein_per_100g !== undefined
      ? { protein_per_100g: toNumber(item.protein_per_100g) }
      : {}),
    ...(item.carbs_per_100g !== null && item.carbs_per_100g !== undefined
      ? { carbs_per_100g: toNumber(item.carbs_per_100g) }
      : {}),
    ...(item.fat_per_100g !== null && item.fat_per_100g !== undefined
      ? { fat_per_100g: toNumber(item.fat_per_100g) }
      : {}),
    matched: item.matched !== false,
  };
}

function mapCloudScan(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const scan = value as Record<string, unknown>;
  if (typeof scan.id !== 'string' || typeof scan.scanned_at !== 'string') return null;

  const rawItems = Array.isArray(scan.scan_items) ? scan.scan_items : [];
  const items = rawItems
    .map((value) => {
      const position =
        value && typeof value === 'object' && 'position' in value
          ? toNumber(value.position)
          : 0;
      return { item: mapCloudItem(value), position };
    })
    .filter(
      (entry): entry is { item: NutritionItem; position: number } => entry.item !== null,
    )
    .sort((left, right) => left.position - right.position)
    .map(({ item }) => item);

  return {
    id: scan.id,
    scanned_at: scan.scanned_at,
    result: {
      total_calories: toNumber(scan.total_calories),
      total_protein_g: toNumber(scan.total_protein_g),
      total_carbs_g: toNumber(scan.total_carbs_g),
      total_fat_g: toNumber(scan.total_fat_g),
      items_detected: items,
    },
    ...(typeof scan.meal_name === 'string' && scan.meal_name.trim()
      ? { meal_name: scan.meal_name.trim() }
      : {}),
    ...(typeof scan.image_path === 'string' ? { image_path: scan.image_path } : {}),
  };
}

async function fetchCloudHistory(
  userId: string,
  localEntries: HistoryEntry[] = [],
): Promise<HistoryEntry[]> {
  const { data, error } = await getSupabase()
    .from('scans')
    .select(
      'id, scanned_at, meal_name, total_calories, total_protein_g, total_carbs_g, total_fat_g, image_path, scan_items(*)',
    )
    .eq('user_id', userId)
    .order('scanned_at', { ascending: false })
    .limit(MAX_ENTRIES);

  if (error) throw error;
  const rows: unknown = data;
  const entries = Array.isArray(rows)
    ? rows.map(mapCloudScan).filter((entry): entry is HistoryEntry => entry !== null)
    : [];
  const localById = new Map(localEntries.map((entry) => [entry.id, entry]));
  const signedUrls = await createMealImageUrls(
    entries.flatMap((entry) => (entry.image_path ? [entry.image_path] : [])),
  );
  return entries.map((entry) => {
    const localEntry = localById.get(entry.id);
    const imageUrl =
      entry.image_path && signedUrls[entry.image_path] ? signedUrls[entry.image_path] : undefined;
    return {
      ...entry,
      // A failed cloud upload must not make the current device's photo vanish.
      ...(!entry.image_path && localEntry?.image_uri
        ? { image_uri: localEntry.image_uri }
        : {}),
      ...(imageUrl ? { image_url: imageUrl } : {}),
    };
  });
}


const cloudScanJobs = new Map<
  string,
  Promise<{ scanId: string; imagePath: string | null }>
>();

async function createCloudScan(
  userId: string,
  entry: HistoryEntry,
): Promise<{ scanId: string; imagePath: string | null }> {
  const { data, error } = await getSupabase()
    .from('scans')
    .insert({
      user_id: userId,
      scanned_at: entry.scanned_at,
      meal_name: entry.meal_name ?? null,
      total_calories: entry.result.total_calories,
      total_protein_g: entry.result.total_protein_g,
      total_carbs_g: entry.result.total_carbs_g,
      total_fat_g: entry.result.total_fat_g,
    })
    .select('id')
    .single();

  const inserted: unknown = data;
  const scanId =
    inserted && typeof inserted === 'object' && 'id' in inserted && typeof inserted.id === 'string'
      ? inserted.id
      : null;
  if (error || !scanId) throw error ?? new Error('The scan could not be saved.');

  if (entry.result.items_detected.length > 0) {
    const { error: itemError } = await getSupabase().from('scan_items').insert(
      entry.result.items_detected.map((item, position) => ({
        scan_id: scanId,
        position,
        name: item.name,
        portion: item.portion,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g ?? 0,
        fat_g: item.fat_g ?? 0,
        original_grams: item.original_grams ?? null,
        calories_per_100g: item.calories_per_100g ?? null,
        protein_per_100g: item.protein_per_100g ?? null,
        carbs_per_100g: item.carbs_per_100g ?? null,
        fat_per_100g: item.fat_per_100g ?? null,
        matched: item.matched !== false,
      })),
    );

    if (itemError) {
      await getSupabase().from('scans').delete().eq('id', scanId);
      throw itemError;
    }
  }

  let imagePath = entry.image_path ?? null;
  if (!imagePath && entry.image_uri) {
    try {
      imagePath = await uploadMealImage(userId, scanId, entry.image_uri);
      if (!imagePath) throw new Error('The meal photo could not be uploaded.');

      const { error: imagePathError } = await getSupabase()
        .from('scans')
        .update({ image_path: imagePath })
        .eq('id', scanId);
      if (imagePathError) throw imagePathError;
    } catch (error) {
      // Keep the local entry pending so History and Last Scan remain usable and
      // the complete scan can be retried instead of becoming image-less in cloud.
      await getSupabase().from('scans').delete().eq('id', scanId);
      if (imagePath) await deleteMealImages([imagePath]);
      throw error;
    }
  }

  return { scanId, imagePath };
}

function getOrCreateCloudScan(
  userId: string,
  entry: HistoryEntry,
): Promise<{ scanId: string; imagePath: string | null }> {
  const key = `${userId}:${entry.id}`;
  const existing = cloudScanJobs.get(key);
  if (existing) return existing;

  const job = createCloudScan(userId, entry).finally(() => {
    cloudScanJobs.delete(key);
  });
  cloudScanJobs.set(key, job);
  return job;
}

async function syncPendingLocalEntries(
  userId: string,
  localEntries: HistoryEntry[],
): Promise<HistoryEntry[]> {
  const synced: HistoryEntry[] = [];

  for (const entry of localEntries) {
    if (UUID_PATTERN.test(entry.id)) {
      synced.push(entry);
      continue;
    }

    try {
      const cloud = await getOrCreateCloudScan(userId, entry);
      synced.push({
        ...entry,
        id: cloud.scanId,
        ...(cloud.imagePath ? { image_path: cloud.imagePath } : {}),
      });
    } catch {
      synced.push(entry);
      break;
    }
  }

  return synced;
}

/**
 * Saves a scan under the name the user chose — locally first, then upgrades it
 * to Supabase cloud history.
 *
 * Returns the id of the stored entry so later portion edits can update exactly
 * this row instead of the client-side analysis id.
 */
export async function recordScan(
  result: NutritionResult,
  mealName: string,
  imageUri?: string,
): Promise<string> {
  const userId = await getAuthenticatedUserId();
  const key = historyKey(userId);
  const trimmedName = mealName.trim();
  const localEntry: HistoryEntry = {
    id: makeId(),
    scanned_at: new Date().toISOString(),
    ...(trimmedName ? { meal_name: trimmedName } : {}),
    result,
    ...(imageUri ? { image_uri: imageUri } : {}),
  };

  // The selected photo must be visible immediately, even while Storage uploads.
  const previousEntries = await readLocalHistory(key);
  await writeLocalHistory(key, [
    localEntry,
    ...previousEntries.filter((entry) => entry.id !== localEntry.id),
  ]);

  if (!userId) return localEntry.id;

  let entryId = localEntry.id;
  try {
    const cloud = await getOrCreateCloudScan(userId, localEntry);
    entryId = cloud.scanId;
    const currentEntries = await readLocalHistory(key);
    const cloudEntry: HistoryEntry = {
      ...localEntry,
      id: cloud.scanId,
      ...(cloud.imagePath ? { image_path: cloud.imagePath } : {}),
    };
    await writeLocalHistory(key, [
      cloudEntry,
      ...currentEntries.filter((entry) => entry.id !== localEntry.id),
    ]);
  } catch {
    // The user-specific local queue will retry the complete scan later.
  }
  return entryId;
}

/** Returns cloud history for the current user, with a per-user offline fallback. */
export async function getHistory(): Promise<HistoryEntry[]> {
  const userId = await getAuthenticatedUserId();
  const key = historyKey(userId);
  const localEntries = await readLocalHistory(key);

  if (!userId) return localEntries;

  const syncedEntries = await syncPendingLocalEntries(userId, localEntries);
  if (syncedEntries.some((entry, index) => entry.id !== localEntries[index]?.id)) {
    await writeLocalHistory(key, syncedEntries);
  }

  try {
    const cloudEntries = await fetchCloudHistory(userId, syncedEntries);
    await writeLocalHistory(key, cloudEntries);
    return cloudEntries;
  } catch {
    return syncedEntries;
  }
}

/** Deletes one scan from Supabase and the current user's offline cache. */
export async function deleteHistoryEntry(id: string): Promise<HistoryEntry[]> {
  const userId = await getAuthenticatedUserId();
  const key = historyKey(userId);

  const localEntries = await readLocalHistory(key);
  const imagePath = localEntries.find((entry) => entry.id === id)?.image_path;
  if (imagePath) await deleteMealImages([imagePath]);

  if (userId && UUID_PATTERN.test(id)) {
    try {
      await getSupabase().from('scans').delete().eq('id', id).eq('user_id', userId);
    } catch {
      // The local cache still reflects the requested deletion.
    }
  }

  await writeLocalHistory(
    key,
    localEntries.filter((entry) => entry.id !== id),
  );
  return getHistory();
}

/** Updates cloud nutrition values after a portion/calorie correction. */
export async function updateHistoryNutrition(
  scanId: string,
  result: NutritionResult,
): Promise<void> {
  if (!UUID_PATTERN.test(scanId)) return;

  const supabase = getSupabase();
  const { error: scanError } = await supabase
    .from('scans')
    .update({
      total_calories: result.total_calories,
      total_protein_g: result.total_protein_g,
      total_carbs_g: result.total_carbs_g,
      total_fat_g: result.total_fat_g,
    })
    .eq('id', scanId);
  if (scanError) throw scanError;

  const { error: deleteError } = await supabase
    .from('scan_items')
    .delete()
    .eq('scan_id', scanId);
  if (deleteError) throw deleteError;

  if (result.items_detected.length === 0) return;
  const { error: insertError } = await supabase.from('scan_items').insert(
    result.items_detected.map((item, position) => ({
      scan_id: scanId,
      position,
      name: item.name,
      portion: item.portion,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g ?? 0,
      fat_g: item.fat_g ?? 0,
      original_grams: item.original_grams ?? null,
      calories_per_100g: item.calories_per_100g ?? null,
      protein_per_100g: item.protein_per_100g ?? null,
      carbs_per_100g: item.carbs_per_100g ?? null,
      fat_per_100g: item.fat_per_100g ?? null,
      matched: item.matched !== false,
    })),
  );
  if (insertError) throw insertError;
}

/** Clears only the current user's Supabase and offline history. */
export async function clearHistory(): Promise<void> {
  const userId = await getAuthenticatedUserId();
  const key = historyKey(userId);

  const imagePaths = new Set(
    (await readLocalHistory(key)).flatMap((entry) => (entry.image_path ? [entry.image_path] : [])),
  );

  if (userId) {
    try {
      const { data } = await getSupabase()
        .from('scans')
        .select('image_path')
        .eq('user_id', userId);
      const rows: unknown = data;
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (
            row &&
            typeof row === 'object' &&
            'image_path' in row &&
            typeof row.image_path === 'string'
          ) {
            imagePaths.add(row.image_path);
          }
        }
      }
      await deleteMealImages([...imagePaths]);
      await getSupabase().from('scans').delete().eq('user_id', userId);
    } catch {
      // Local clearing still prevents cross-account visibility on this device.
    }
  }

  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Best-effort local cleanup.
  }
}

