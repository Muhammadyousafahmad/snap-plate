import type { User } from '@supabase/supabase-js';

import { getDailyGoals, type DailyGoals } from '@/services/goals';
import { getHistory, type HistoryEntry } from '@/services/history';
import { getSupabase } from '@/services/supabase';

/** Number of days covered by the dashboard activity chart. */
const WEEK_LENGTH = 7;

/** Calorie and macro sums for a set of scans or a single day. */
export interface MacroTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** One column of the dashboard activity chart. */
export interface WeekDayPoint {
  /** Local day key (YYYY-MM-DD) used as a stable React key. */
  key: string;
  /** Short localized weekday label, e.g. "Mon". */
  label: string;
  calories: number;
  scans: number;
  isToday: boolean;
}

/** Most frequently scanned food inside the chart window. */
export interface TopFood {
  name: string;
  count: number;
}

/** Everything the dashboard renders: today's numbers plus the weekly trend. */
export interface DashboardData {
  displayName: string;
  firstName: string;
  email: string | null;
  /** True once the account's email address has been confirmed. */
  isEmailVerified: boolean;
  goals: DailyGoals;
  /** Calories and macros eaten today. */
  today: MacroTotals;
  /** Number of meals logged today. */
  todayScans: number;
  /** Today's scans, newest first. */
  todayMeals: HistoryEntry[];
  /** Daily calorie totals for the chart, oldest first. */
  last7Days: WeekDayPoint[];
  weekTotals: MacroTotals;
  weekScans: number;
  /** Consecutive logged days, counted from today (or yesterday) backwards. */
  streakDays: number;
  totalScans: number;
  averageCalories: number;
  topFood: TopFood | null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

/** Local ISO day key so meals group by the user's calendar day, not UTC. */
function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function emptyTotals(): MacroTotals {
  return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
}

function addToTotals(totals: MacroTotals, entry: HistoryEntry): MacroTotals {
  return {
    calories: totals.calories + entry.result.total_calories,
    protein_g: totals.protein_g + entry.result.total_protein_g,
    carbs_g: totals.carbs_g + entry.result.total_carbs_g,
    fat_g: totals.fat_g + entry.result.total_fat_g,
  };
}

/**
 * Consecutive logged days ending today, or ending yesterday when today has no
 * scan yet so an active streak is not reported as broken before the day ends.
 */
function computeStreak(scannedDays: Set<string>, today: Date): number {
  let cursor = scannedDays.has(dayKey(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (scannedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function computeTopFood(entries: HistoryEntry[]): TopFood | null {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const item of entry.result.items_detected) {
      const name = item.name.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  let top: TopFood | null = null;
  for (const [name, count] of counts) {
    if (!top || count > top.count) top = { name, count };
  }
  return top;
}

/** Mirrors the profile screen so the dashboard greets the user by their name. */
function getDisplayName(user: User | null): string {
  if (!user) return 'SnapPlate user';
  const fullName = user.user_metadata.full_name;
  const name = user.user_metadata.name;
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim();
  if (typeof name === 'string' && name.trim()) return name.trim();
  return user.email?.split('@')[0] ?? 'SnapPlate user';
}

/** Progress towards a goal as a whole percentage, capped so bars never overflow. */
export function goalPercent(value: number, goal: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(goal) || goal <= 0) return 0;
  return Math.min(Math.round((value / goal) * 100), 999);
}

/** Aggregates history into every number the dashboard renders. */
export function buildDashboard(
  entries: HistoryEntry[],
  goals: DailyGoals,
  user: User | null,
  now: Date = new Date(),
): DashboardData {
  const today = startOfDay(now);
  const todayKey = dayKey(today);
  const sorted = [...entries].sort(
    (left, right) => toTimestamp(right.scanned_at) - toTimestamp(left.scanned_at),
  );

  const scannedDays = new Set<string>();
  const totalsByDay = new Map<string, MacroTotals>();
  const scansByDay = new Map<string, number>();

  for (const entry of sorted) {
    const scannedAt = new Date(entry.scanned_at);
    if (Number.isNaN(scannedAt.getTime())) continue;
    const key = dayKey(scannedAt);
    scannedDays.add(key);
    totalsByDay.set(key, addToTotals(totalsByDay.get(key) ?? emptyTotals(), entry));
    scansByDay.set(key, (scansByDay.get(key) ?? 0) + 1);
  }

  const last7Days: WeekDayPoint[] = [];
  for (let offset = WEEK_LENGTH - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const key = dayKey(date);
    last7Days.push({
      key,
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      calories: totalsByDay.get(key)?.calories ?? 0,
      scans: scansByDay.get(key) ?? 0,
      isToday: offset === 0,
    });
  }

  const weekTotals = last7Days.reduce<MacroTotals>((totals, day) => {
    const dayTotals = totalsByDay.get(day.key) ?? emptyTotals();
    return {
      calories: totals.calories + dayTotals.calories,
      protein_g: totals.protein_g + dayTotals.protein_g,
      carbs_g: totals.carbs_g + dayTotals.carbs_g,
      fat_g: totals.fat_g + dayTotals.fat_g,
    };
  }, emptyTotals());
  const weekScans = last7Days.reduce((sum, day) => sum + day.scans, 0);

  const weekKeys = new Set(last7Days.map((day) => day.key));
  const weekEntries = sorted.filter((entry) => {
    const scannedAt = new Date(entry.scanned_at);
    return !Number.isNaN(scannedAt.getTime()) && weekKeys.has(dayKey(scannedAt));
  });

  const todayMeals = sorted.filter((entry) => {
    const scannedAt = new Date(entry.scanned_at);
    return !Number.isNaN(scannedAt.getTime()) && dayKey(scannedAt) === todayKey;
  });

  const allTotals = sorted.reduce<MacroTotals>(
    (totals, entry) => addToTotals(totals, entry),
    emptyTotals(),
  );
  const totalScans = sorted.length;
  const displayName = getDisplayName(user);

  return {
    displayName,
    firstName: displayName.split(/\s+/)[0] ?? displayName,
    email: user?.email ?? null,
    isEmailVerified: Boolean(user?.email_confirmed_at),
    goals,
    today: totalsByDay.get(todayKey) ?? emptyTotals(),
    todayScans: scansByDay.get(todayKey) ?? 0,
    todayMeals,
    last7Days,
    weekTotals,
    weekScans,
    streakDays: computeStreak(scannedDays, today),
    totalScans,
    averageCalories: totalScans > 0 ? allTotals.calories / totalScans : 0,
    topFood: computeTopFood(weekEntries),
  };
}

/** Loads the signed-in user's profile, history and goals in one round trip. */
export async function loadDashboard(): Promise<DashboardData> {
  const [{ data }, history, goals] = await Promise.all([
    getSupabase().auth.getUser(),
    getHistory(),
    getDailyGoals(),
  ]);
  return buildDashboard(history, goals, data.user);
}
