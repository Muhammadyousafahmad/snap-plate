import type { NutritionItem, NutritionResult } from './ai';

const DEFAULT_ORIGINAL_GRAMS = 100;

function round(value: number): number {
  return Math.round(value);
}

export function hasNutritionBaseline(item: NutritionItem): boolean {
  return [item.calories_per_100g, item.protein_per_100g, item.carbs_per_100g, item.fat_per_100g].every(
    (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0,
  );
}

export function getOriginalGrams(item: NutritionItem): number {
  if (typeof item.original_grams === 'number' && item.original_grams > 0) {
    return item.original_grams;
  }
  const matches = [...item.portion.matchAll(/([\d.]+)\s*(?:g|grams?)\b/gi)];
  const last = matches[matches.length - 1];
  const parsed = last ? Number(last[1]) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ORIGINAL_GRAMS;
}

/** Adds immutable USDA per-100g baselines to new and legacy items. */
export function withNutritionBaseline(item: NutritionItem): NutritionItem {
  if (hasNutritionBaseline(item)) return item;
  const originalGrams = getOriginalGrams(item);
  const factor = 100 / originalGrams;
  return {
    ...item,
    original_grams: originalGrams,
    calories_per_100g: item.calories * factor,
    protein_per_100g: item.protein_g * factor,
    carbs_per_100g: (item.carbs_g ?? 0) * factor,
    fat_per_100g: (item.fat_g ?? 0) * factor,
  };
}

/** Shared calculation used by both edit preview and save. */
export function scaleNutritionItem(item: NutritionItem, grams: number): NutritionItem {
  const baseline = withNutritionBaseline(item);
  const factor = grams / 100;
  return {
    ...baseline,
    portion: `${Math.round(grams * 100) / 100} g`,
    calories: round((baseline.calories_per_100g ?? 0) * factor),
    protein_g: round((baseline.protein_per_100g ?? 0) * factor),
    carbs_g: round((baseline.carbs_per_100g ?? 0) * factor),
    fat_g: round((baseline.fat_per_100g ?? 0) * factor),
  };
}

export function sumNutrition(items: NutritionItem[]): NutritionResult {
  return {
    total_calories: items.reduce((sum, item) => sum + round(item.calories), 0),
    total_protein_g: items.reduce((sum, item) => sum + round(item.protein_g), 0),
    total_carbs_g: items.reduce((sum, item) => sum + round(item.carbs_g ?? 0), 0),
    total_fat_g: items.reduce((sum, item) => sum + round(item.fat_g ?? 0), 0),
    items_detected: items,
  };
}
