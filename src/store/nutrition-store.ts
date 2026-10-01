import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { NutritionItem, NutritionResult } from '@/services/ai';
import { getHistory, updateHistoryNutrition } from '@/services/history';
import { scaleNutritionItem, sumNutrition, withNutritionBaseline } from '@/services/nutrition-math';
import { getSupabase } from '@/services/supabase';

const RESULT_STORAGE_KEY_PREFIX = 'snapplate.nutrition-result.v2';

type StoredResult = {
  result: NutritionResult;
  analysisId: string;
  scannedAt: string;
  imageUri?: string;
  imageUrl?: string;
};

let persistQueue: Promise<void> = Promise.resolve();

async function getResultStorageKey(): Promise<string | null> {
  try {
    const { data, error } = await getSupabase().auth.getUser();
    return error ? null : `${RESULT_STORAGE_KEY_PREFIX}.${data.user.id}`;
  } catch {
    return null;
  }
}

export type PendingImage = {
  /** Local file URI of the photo to analyze. */
  uri: string;
  /** MIME type of the source image. */
  mimeType: string;
  /** Unique id that links a scan to its analysis query. */
  analysisId: string;
};

type NutritionState = {
  pendingImage: PendingImage | null;
  lastResult: NutritionResult | null;
  lastAnalysisId: string | null;
  lastScanAt: string | null;
  lastImageUri: string | null;
  lastImageUrl: string | null;
  /** Analysis id the user already saved to History under a chosen name. */
  lastSavedAnalysisId: string | null;
  /** History/Cloud row id of that saved scan (used for later portion edits). */
  lastHistoryEntryId: string | null;
  setPendingImage: (image: PendingImage) => void;
  setResult: (result: NutritionResult, analysisId: string) => void;
  /** Marks the current analysis as saved to History under `entryId`. */
  markSaved: (analysisId: string, entryId: string) => void;
  updateItemWeight: (itemIndex: number, grams: number) => void;
  hydrateResult: () => Promise<void>;
  reset: () => void;
};

function distributeFat(totalFat: number, items: NutritionItem[]): number[] {
  const calories = items.map((item) => Math.max(item.calories, 0));
  const totalCalories = calories.reduce((sum, value) => sum + value, 0);
  if (totalCalories === 0 || totalFat === 0) {
    return items.map(() => totalFat / Math.max(items.length, 1));
  }
  return calories.map((value) => (value / totalCalories) * totalFat);
}

/** Adds per-item fat for local scaling while preserving the existing wire shape. */
function withItemFat(result: NutritionResult): NutritionResult {
  const hasCompleteFat = result.items_detected.every((item) => typeof item.fat_g === 'number');
  const fatByItem = hasCompleteFat
    ? result.items_detected.map((item) => item.fat_g ?? 0)
    : distributeFat(result.total_fat_g, result.items_detected);
  return {
    ...result,
    items_detected: result.items_detected.map((item, index) => {
      const itemWithFat = { ...item, fat_g: fatByItem[index] ?? 0 };
      return {
        ...withNutritionBaseline(itemWithFat),
        fat_g: itemWithFat.fat_g,
      };
    }),
  };
}

async function persistResult(
  result: NutritionResult,
  analysisId: string,
  scannedAt: string,
  imageUri?: string,
): Promise<void> {
  const key = await getResultStorageKey();
  if (!key) return;

  const payload: StoredResult = {
    result,
    analysisId,
    scannedAt,
    ...(imageUri ? { imageUri } : {}),
  };
  persistQueue = persistQueue
    .then(() => AsyncStorage.setItem(key, JSON.stringify(payload)))
    .then(() => undefined)
    .catch(() => undefined);
}

function toTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export const useNutritionStore = create<NutritionState>((set, get) => ({
  pendingImage: null,
  lastResult: null,
  lastAnalysisId: null,
  lastScanAt: null,
  lastImageUri: null,
  lastImageUrl: null,
  lastSavedAnalysisId: null,
  lastHistoryEntryId: null,
  setPendingImage: (image) => set({ pendingImage: image }),
  setResult: (result, analysisId) => {
    const nextResult = withItemFat(result);
    const scannedAt = new Date().toISOString();
    const imageUri = get().pendingImage?.uri;
    set((state) => ({
      lastResult: nextResult,
      lastAnalysisId: analysisId,
      lastScanAt: scannedAt,
      lastImageUri: imageUri ?? null,
      lastImageUrl: null,
      // A new analysis is unsaved; re-caching the same one keeps its saved state.
      lastSavedAnalysisId:
        state.lastSavedAnalysisId === analysisId ? state.lastSavedAnalysisId : null,
      lastHistoryEntryId:
        state.lastSavedAnalysisId === analysisId ? state.lastHistoryEntryId : null,
    }));
    void persistResult(nextResult, analysisId, scannedAt, imageUri);
  },
  markSaved: (analysisId, entryId) =>
    set({ lastSavedAnalysisId: analysisId, lastHistoryEntryId: entryId }),
  updateItemWeight: (itemIndex, grams) => {
    const { lastResult, lastAnalysisId, lastScanAt } = get();
    if (
      !lastResult ||
      !lastAnalysisId ||
      !lastScanAt ||
      !Number.isFinite(grams) ||
      grams <= 0
    ) {
      return;
    }

    const item = lastResult.items_detected[itemIndex];
    if (!item) return;
    const nextItems = lastResult.items_detected.map((current, index) =>
      index === itemIndex ? scaleNutritionItem(current, grams) : current,
    );
    const nextResult = sumNutrition(nextItems);
    set({ lastResult: nextResult });
    void persistResult(nextResult, lastAnalysisId, lastScanAt, get().lastImageUri ?? undefined);
    // Once the meal has a History row, edits must target that row's id rather
    // than the client-side analysis id (which is not a UUID).
    void updateHistoryNutrition(get().lastHistoryEntryId ?? lastAnalysisId, nextResult).catch(
      () => undefined,
    );
  },
  hydrateResult: async () => {
    try {
      const key = await getResultStorageKey();
      if (!key) {
        set({
          lastResult: null,
          lastAnalysisId: null,
          lastScanAt: null,
          lastImageUri: null,
          lastImageUrl: null,
          lastSavedAnalysisId: null,
          lastHistoryEntryId: null,
        });
        return;
      }

      let localEntry: StoredResult | null = null;
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const stored = JSON.parse(raw) as Partial<StoredResult>;
        if (
          stored.result &&
          typeof stored.analysisId === 'string' &&
          Array.isArray(stored.result.items_detected)
        ) {
          localEntry = {
            result: stored.result,
            analysisId: stored.analysisId,
            scannedAt:
              typeof stored.scannedAt === 'string' ? stored.scannedAt : new Date(0).toISOString(),
            ...(typeof stored.imageUri === 'string' ? { imageUri: stored.imageUri } : {}),
          };
        }
      }

      const latestCloudEntry = (await getHistory())[0];
      const cloudEntry: StoredResult | null = latestCloudEntry
        ? {
            result: latestCloudEntry.result,
            analysisId: latestCloudEntry.id,
            scannedAt: latestCloudEntry.scanned_at,
            ...(latestCloudEntry.image_uri ? { imageUri: latestCloudEntry.image_uri } : {}),
            ...(latestCloudEntry.image_url ? { imageUrl: latestCloudEntry.image_url } : {}),
          }
        : null;

      const selected =
        cloudEntry &&
        (!localEntry || toTimestamp(cloudEntry.scannedAt) >= toTimestamp(localEntry.scannedAt))
          ? cloudEntry
          : localEntry;

      if (!selected) {
        set({
          lastResult: null,
          lastAnalysisId: null,
          lastScanAt: null,
          lastImageUri: null,
          lastImageUrl: null,
          lastSavedAnalysisId: null,
          lastHistoryEntryId: null,
        });
        return;
      }

      set({
        lastResult: withItemFat(selected.result),
        lastAnalysisId: selected.analysisId,
        lastScanAt: selected.scannedAt,
        lastImageUri: selected.imageUri ?? null,
        lastImageUrl: selected.imageUrl ?? null,
        lastSavedAnalysisId: null,
        lastHistoryEntryId: null,
      });
    } catch {
      // A malformed cache must not prevent the app from opening.
    }
  },
  reset: () =>
    set({
      pendingImage: null,
      lastResult: null,
      lastAnalysisId: null,
      lastScanAt: null,
      lastImageUri: null,
      lastImageUrl: null,
      lastSavedAnalysisId: null,
      lastHistoryEntryId: null,
    }),
}));

