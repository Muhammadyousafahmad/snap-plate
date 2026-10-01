import Constants from 'expo-constants';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { getSupabase } from '@/services/supabase';

/**
 * ==== SnapPlate AI service layer ====
 * Analyzes a food photo and returns estimated macros.
 * Providers:
 *  1. The analyze-meal backend (POST JSON, expects NutritionResult back).

 *
 * Nutrition numbers are computed server-side (USDA FoodData Central lookups in
 * the analyze-meal Edge Function). This client never calls an AI API directly,
 * so no Gemini key is needed in the app bundle anymore.
 */

export interface NutritionItem {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g?: number;
  /** Optional per-item fat used by local portion editing. */
  fat_g?: number;
  /** Immutable Gemini estimate used as the recalculation baseline. */
  original_grams?: number;
  /** Raw USDA baselines used to avoid rounding drift during repeated edits. */
  calories_per_100g?: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fat_per_100g?: number;
  /**
   * False when USDA FoodData Central found no acceptable record — the item's
   * nutrition values are then 0 by design rather than fabricated. Optional so
   * the client contract stays exactly as before.
   */
  matched?: boolean;
}

export interface NutritionResult {
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  items_detected: NutritionItem[];
}



export type AnalyzeResult = NutritionResult;



/** Path of the analyze-meal function on the server (same local and deployed). */
const ANALYZE_PATH = '/functions/v1/analyze-meal';

/**
 * Port the local dev server listens on.
 * `deno run --allow-net --allow-env --env-file=supabase/functions/.env supabase/functions/analyze-meal/index.ts`
 * binds 0.0.0.0:8000 (all interfaces), so phones, emulators and the web build
 * can all reach it on this machine's address.
 */
const DEV_SERVER_PORT = 8000;

/**
 * Resolves the analyze-meal URL for whatever network the device is currently
 * on, so the app keeps working when you switch between Wi-Fi, a phone hotspot,
 * an emulator or the web build — with no IP hardcoded in .env.
 *
 * Resolution order:
 *  1. `EXPO_PUBLIC_API_URL` — explicit override. Set it for a deployed function
 *     or to force a specific host.
 *  2. The host of the Metro dev server the bundle was loaded from. Metro's URL
 *     already carries the machine's reachable IP (e.g. 192.168.137.1:8081) and
 *     the device proved it can reach that address by loading the app from it,
 *     so the analyze server is reached on the same host at port 8000.
 *  3. Nothing available (production build, no env var) -> undefined.
 */
export function resolveApiUrl(): string | undefined {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit) return explicit;

  // A production build has no dev server, so never guess a host there.
  if (process.env.NODE_ENV === 'production') return undefined;

  const host = devServerHost();
  return host ? `http://${host}:${DEV_SERVER_PORT}${ANALYZE_PATH}` : undefined;
}

/** The host the JS bundle was served from, e.g. "192.168.137.1:8081". */
function devServerHost(): string | undefined {
  const candidates = [
    readStringField(Constants.expoConfig, 'hostUri'),
    readStringField(Constants.expoGoConfig, 'debuggerHost'),
    readStringField(Constants.expoGoConfig, 'hostUri'),
    hostFromUrl(Constants.experienceUrl),
  ];
  for (const candidate of candidates) {
    const host = normalizeHost(candidate);
    if (host) return host;
  }
  return undefined;
}

/** Reads a single string property off an unknown object without using `any`. */
function readStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === 'string' ? raw : undefined;
}

/** "exp://192.168.23.139:8081" -> "192.168.23.139:8081" */
function hostFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url);
  return match?.[1];
}

/** "192.168.23.139:8081" -> "192.168.23.139" (IPv6 brackets are preserved). */
function normalizeHost(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const hostAndPort = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split(/[/?#]/)[0].trim();
  if (hostAndPort.startsWith('[')) {
    const end = hostAndPort.indexOf(']');
    return end > 0 ? hostAndPort.slice(0, end + 1) : undefined;
  }
  const host = hostAndPort.split(':')[0].trim();
  if (!/^[A-Za-z0-9._-]+$/.test(host)) return undefined;
  return host.length > 0 ? host : undefined;
}



/** Analyzes the meal photo at `uri`. The image is compressed + resized before sending. */
export async function analyzeMealImage(uri: string): Promise<AnalyzeResult> {
  const prepared = await prepareImage(uri);
  // Nothing is written to History here: the results screen first asks the user
  // under which name the meal should be saved.
  return analyzeWithBackend(prepared.base64);
}

interface PreparedImage {
  base64: string;
}

/** Resizes to a max width of 1024px and re-encodes as JPEG. */
async function prepareImage(uri: string): Promise<PreparedImage> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.7, format: SaveFormat.JPEG, base64: true }
  );
  if (!result.base64) {
    throw new Error('Could not encode the image.');
  }
  return { base64: result.base64 };
}

/**
 * Returns the signed-in user's Supabase access token (a short-lived JWT), or
 * undefined when there is no session. The `analyze-meal` Edge Function runs with
 * `verify_jwt = true`, so this token — not the public anon key — belongs in the
 * `Authorization` header.
 */
async function getUserAccessToken(): Promise<string | undefined> {
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) return undefined;
    return data.session?.access_token;
  } catch {
    // Supabase is unconfigured (missing env vars) or storage is unavailable.
    return undefined;
  }
}

async function analyzeWithBackend(base64: string): Promise<NutritionResult> {
  const endpoint = resolveApiUrl();
  if (!endpoint) {
    throw new Error('No analyze API URL could be resolved for this device.');
  }

  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  // Prefer the signed-in user's JWT; the anon key is only a signed-out fallback.
  const authToken = (await getUserAccessToken()) ?? anonKey;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The public anon key identifies the project at the Supabase gateway
        // (required when verify_jwt = true in supabase/config.toml).
        ...(anonKey ? { apikey: anonKey } : {}),
        // The gateway reads the signed-in user's JWT from Authorization, so it
        // resolves the `authenticated` role instead of `anon` and the function
        // sees the real user (auth.uid()). The anon key is only used when there
        // is no session to fall back to.
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ image_base64: base64, mime_type: 'image/jpeg' }),
    });
  } catch {
    // A network-level failure (server not started, wrong network, airplane mode).
    // Say so explicitly instead of surfacing a bare "Network request failed".
    throw new Error(
      `Could not reach the analysis server at ${endpoint}. Make sure it is running ` +
        `(deno run --allow-net --allow-env --env-file=supabase/functions/.env supabase/functions/analyze-meal/index.ts) ` +
        'and that this device is on the same network as the computer running it.'
    );
  }

  const json = (await response.json().catch(() => null)) as
    | { error?: { message?: string }; result?: unknown }
    | null;

  if (!response.ok) {
    throw new Error(json?.error?.message ?? `The API request failed (status ${response.status}).`);
  }

  return parseNutritionResult(json?.result ?? json);
}

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : 0;
}

/** Defensively normalizes any payload into the NutritionResult interface. */
function parseNutritionResult(input: unknown): NutritionResult {
  const raw = (input ?? {}) as Partial<NutritionResult> & Record<string, unknown>;

  const items = Array.isArray(raw.items_detected)
    ? (raw.items_detected as (Partial<NutritionItem> & Record<string, unknown>)[]).map((item) => ({
        name: typeof item.name === 'string' ? item.name : 'Unknown item',
        portion: typeof item.portion === 'string' ? item.portion : '—',
        calories: toNumber(item.calories),
        protein_g: toNumber(item.protein_g),
        carbs_g: toNumber(item.carbs_g),
        fat_g: typeof item.fat_g === 'number' ? toNumber(item.fat_g) : undefined,
        original_grams:
          typeof item.original_grams === 'number' && item.original_grams > 0
            ? item.original_grams
            : undefined,
        calories_per_100g:
          typeof item.calories_per_100g === 'number' ? item.calories_per_100g : undefined,
        protein_per_100g:
          typeof item.protein_per_100g === 'number' ? item.protein_per_100g : undefined,
        carbs_per_100g:
          typeof item.carbs_per_100g === 'number' ? item.carbs_per_100g : undefined,
        fat_per_100g:
          typeof item.fat_per_100g === 'number' ? item.fat_per_100g : undefined,
        matched: typeof item.matched === 'boolean' ? item.matched : undefined,
      }))
    : [];

  return {
    total_calories: toNumber(raw.total_calories),
    total_protein_g: toNumber(raw.total_protein_g),
    total_carbs_g: toNumber(raw.total_carbs_g),
    total_fat_g: toNumber(raw.total_fat_g),
    items_detected: items,
  };
}