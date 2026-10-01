/** Item as requested from Gemini: identified food + portion grams, NO macros. */
export interface GeminiItem {
  name: string;
  estimated_grams: number;
}

/** A single nutrient entry inside an FDC food record. */
export interface FdcNutrientEntry {
  nutrientId: number;
  nutrientName?: string;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
}

/** One food record from the FDC /foods/search response. */
export interface FdcFood {
  fdcId: number;
  description: string;
  dataType?: string;
  score?: number;
  foodNutrients?: FdcNutrientEntry[];
}

/** Parsed /foods/search response — only the fields we consume. */
export interface FdcSearchResponse {
  totalHits?: number;
  foods?: FdcFood[];
}

/** Per-100 g nutrition extracted from an FDC record. */
export interface FdcNutrients {
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

/** Fully resolved item with an immutable gram baseline for client-side edits. */
export interface ResolvedItem {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  original_grams: number;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  matched: boolean;
}

/** Exact wire shape the client expects (NutritionResult). */
export interface NutritionResult {
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  items_detected: Array<{
    name: string;
    portion: string;
    calories: number;
    protein_g: number;
    carbs_g?: number;
    fat_g?: number;
    /** Exact Gemini portion estimate used as the immutable recalculation baseline. */
    original_grams?: number;
    calories_per_100g?: number;
    protein_per_100g?: number;
    carbs_per_100g?: number;
    fat_per_100g?: number;
    /** Present only when the FDC lookup found no good match. */
    matched?: boolean;
  }>;
}

/** HTTP error that maps 1:1 to a `{ error: { message } }` JSON response. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
