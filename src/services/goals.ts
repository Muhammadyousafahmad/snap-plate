import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabase } from '@/services/supabase';

/**
 * Daily nutrition targets that power the dashboard progress bars.
 * Goals are stored per user so two accounts on one device never share targets.
 */
export interface DailyGoals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Balanced 2,000 kcal starting point until the user customizes their targets. */
export const DEFAULT_DAILY_GOALS: DailyGoals = {
  calories: 2000,
  protein_g: 150,
  carbs_g: 250,
  fat_g: 65,
};

const GOALS_KEY_PREFIX = 'snapplate.daily-goals.v1';
const DEVICE_GOALS_KEY = `${GOALS_KEY_PREFIX}.device`;
/** Guards against typos such as an extra zero while staying generous. */
const MIN_GOAL = 1;
const MAX_GOAL = 20000;

function clampGoal(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), MIN_GOAL), MAX_GOAL);
}

/** Keeps stored or user-entered goals inside sane bounds. */
export function sanitizeGoals(input: Partial<DailyGoals> | null | undefined): DailyGoals {
  return {
    calories: clampGoal(input?.calories, DEFAULT_DAILY_GOALS.calories),
    protein_g: clampGoal(input?.protein_g, DEFAULT_DAILY_GOALS.protein_g),
    carbs_g: clampGoal(input?.carbs_g, DEFAULT_DAILY_GOALS.carbs_g),
    fat_g: clampGoal(input?.fat_g, DEFAULT_DAILY_GOALS.fat_g),
  };
}

/** User-scoped cache key, mirroring the history store's isolation strategy. */
async function goalsKey(): Promise<string> {
  try {
    const { data, error } = await getSupabase().auth.getUser();
    return error ? DEVICE_GOALS_KEY : `${GOALS_KEY_PREFIX}.${data.user.id}`;
  } catch {
    return DEVICE_GOALS_KEY;
  }
}

/** Reads the current user's daily goals, falling back to balanced defaults. */
export async function getDailyGoals(): Promise<DailyGoals> {
  try {
    const stored = await AsyncStorage.getItem(await goalsKey());
    if (!stored) return DEFAULT_DAILY_GOALS;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_DAILY_GOALS;
    return sanitizeGoals(parsed as Partial<DailyGoals>);
  } catch {
    return DEFAULT_DAILY_GOALS;
  }
}

/** Stores sanitized goals for the current user and returns the saved values. */
export async function saveDailyGoals(goals: DailyGoals): Promise<DailyGoals> {
  const sanitized = sanitizeGoals(goals);
  try {
    await AsyncStorage.setItem(await goalsKey(), JSON.stringify(sanitized));
  } catch {
    // The dashboard still uses the returned values for the current session.
  }
  return sanitized;
}
