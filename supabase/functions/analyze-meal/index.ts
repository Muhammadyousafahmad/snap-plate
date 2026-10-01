/**
 * SnapPlate — analyze-meal Supabase Edge Function (Deno / TypeScript)
 */

import { ApiError, type FdcNutrients, type GeminiItem, type NutritionResult, type ResolvedItem } from './types.ts';
import { authenticateRequest } from './auth.ts';
import { identifyFoodItems } from './gemini.ts';
import { lookupNutrition } from './usda.ts';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // the client compresses to ~1 MB; 12 MB is a hard ceiling

// ── CORS ─────────────────────────────────────────────────────────────────────
// Reflect only an Origin that is explicitly allowed instead of answering every
// caller with `Access-Control-Allow-Origin: *`. Native (Expo) requests send no
// Origin header and are unaffected; this keeps the response readable only to the
// deployed web build. Configure the web app's origin(s) with the comma-separated
// ALLOWED_ORIGINS secret — the defaults cover local Expo web during development.
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:8081', 'http://localhost:19006'];
const CONFIGURED_ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
const ALLOWED_ORIGINS =
  CONFIGURED_ALLOWED_ORIGINS.length > 0 ? CONFIGURED_ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS;

/**
 * CORS headers for one request. `Access-Control-Allow-Origin` is added only when
 * the request's Origin is on the allowlist, so an unlisted browser origin is not
 * granted read access. `Vary: Origin` keeps caches from mixing the responses.
 */
function corsHeadersFor(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    Vary: 'Origin',
  };
  const origin = req.headers.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// ── Rate limiting (10 requests / 60 s per client) ───────────────────────────
// Primary limiter: the `check_rate_limit` Postgres function (see the migrations)
// called through PostgREST, so the counter is shared by every Edge Function
// replica instead of being per-instance. Falls back to the in-memory limiter
// below when the service role / project URL are unavailable (local `deno run`)
// or the shared limiter errors — best effort rather than failing open entirely.
const RATE_LIMIT_MAX = 10; // max requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1-minute rolling window
const RATE_LIMIT_WINDOW_SECONDS = RATE_LIMIT_WINDOW_MS / 1000;

/** In-memory fallback — per-instance, used only if the shared limiter is down. */
type Bucket = { count: number; windowStart: number };
const rateBuckets = new Map<string, Bucket>();

function isRateLimitedInMemory(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

/** Pulls the first key out of the SUPABASE_SECRET_KEYS JSON dictionary. */
function firstSecretKey(json: string | undefined): string | undefined {
  if (!json) return undefined;
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object') {
      const values = Object.values(parsed as Record<string, unknown>);
      const first = values.find((value) => typeof value === 'string' && value.length > 0);
      if (typeof first === 'string') return first;
    }
  } catch {
    // Malformed dictionary — treat the shared limiter as unconfigured.
  }
  return undefined;
}

/**
 * Resolves the project URL and a secret (service-role) key for the shared
 * limiter. Supports both the legacy and the current API-key variables the
 * platform injects. Returns null when they are not set (e.g. local `deno run`).
 */
function sharedRateLimiterConfig(): { url: string; secretKey: string } | null {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) return null;

  const secretKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SECRET_KEY') ??
    firstSecretKey(Deno.env.get('SUPABASE_SECRET_KEYS'));
  if (!secretKey) return null;

  return { url: url.replace(/\/+$/, ''), secretKey };
}

/** True when `key` has exceeded RATE_LIMIT_MAX requests in the current window. */
async function isRateLimited(key: string): Promise<boolean> {
  const config = sharedRateLimiterConfig();
  if (!config) return isRateLimitedInMemory(key);

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.secretKey,
        Authorization: `Bearer ${config.secretKey}`,
      },
      body: JSON.stringify({
        p_key: key,
        p_max: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      }),
    });
    if (!response.ok) throw new Error(`shared limiter returned ${response.status}`);
    const allowed: unknown = await response.json();
    if (typeof allowed !== 'boolean') throw new Error('shared limiter returned a non-boolean');
    return !allowed;
  } catch (err) {
    console.warn(
      '[analyze-meal] Shared rate limiter unavailable; using the in-memory fallback.',
      err instanceof Error ? err.message : String(err)
    );
    return isRateLimitedInMemory(key);
  }
}

// ── Resolution & aggregation ─────────────────────────────────────────────────

/** Turns a Gemini item + optional per-100 g data into a rounded client item. */
export function resolveItem(gemini: GeminiItem, nutrients: FdcNutrients | null): ResolvedItem {
  const grams = gemini.estimated_grams;
  const matched = grams > 0 && nutrients !== null;

  if (!matched) {
    return {
      name: gemini.name,
      portion: `${grams} g`,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      original_grams: grams,
      calories_per_100g: 0,
      protein_per_100g: 0,
      carbs_per_100g: 0,
      fat_per_100g: 0,
      matched: false,
    };
  }

  const factor = grams / 100;
  return {
    name: gemini.name,
    portion: `${Math.round(grams)} g`,
    calories: Math.round(nutrients!.caloriesPer100g * factor),
    protein_g: Math.round(nutrients!.proteinPer100g * factor),
    carbs_g: Math.round(nutrients!.carbsPer100g * factor),
    fat_g: Math.round(nutrients!.fatPer100g * factor),
    original_grams: grams,
    calories_per_100g: nutrients!.caloriesPer100g,
    protein_per_100g: nutrients!.proteinPer100g,
    carbs_per_100g: nutrients!.carbsPer100g,
    fat_per_100g: nutrients!.fatPer100g,
    matched: true,
  };
}

/** Sums items into the exact NutritionResult contract shape. */
export function aggregate(resolved: ResolvedItem[]): NutritionResult {
  const sum = (field: (item: ResolvedItem) => number): number =>
    Math.round(resolved.reduce((acc, item) => acc + field(item), 0));

  return {
    total_calories: sum((item) => item.calories),
    total_protein_g: sum((item) => item.protein_g),
    total_carbs_g: sum((item) => item.carbs_g),
    total_fat_g: sum((item) => item.fat_g),
    items_detected: resolved.map((item) => ({
      name: item.name,
      portion: item.portion,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      original_grams: item.original_grams,
      calories_per_100g: item.calories_per_100g,
      protein_per_100g: item.protein_per_100g,
      carbs_per_100g: item.carbs_per_100g,
      fat_per_100g: item.fat_per_100g,
      matched: item.matched,
    })),
  };
}

// ── Request handling ─────────────────────────────────────────────────────────

function jsonResponseWith(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

/**
 * Validates the client payload and returns the base64 image string + mime type.
 * The client sends `{ "image_base64": "<no data URI prefix>", "mime_type": "image/jpeg" }`.
 */
export function extractImagePayload(body: Record<string, unknown>): { imageBase64: string; mimeType: string } {
  const rawBase64 = body.image_base64;
  if (typeof rawBase64 !== 'string' || rawBase64.trim() === '') {
    throw new ApiError(400, 'Missing "image_base64" string in request body.');
  }
  const mimeType = typeof body.mime_type === 'string' && /^image\//.test(body.mime_type)
    ? body.mime_type
    : 'image/jpeg';

  // Tolerate a data-URI prefix if a client ever sends one by mistake.
  const clean = rawBase64
    .trim()
    .replace(/^data:[^;,]+;base64,/i, '')
    .replace(/\s+/g, '');

  // ── Security: pre-atob size check ───────────────────────────────────────────
  // Base64 expands binary by ~4/3, so 16 MB of base64 ≈ 12 MB decoded.
  // Reject the string BEFORE calling atob() to prevent memory allocation attacks
  // from forcing the runtime to decode and hold a massive binary buffer.
  const MAX_BASE64_CHARS = 16 * 1024 * 1024; // 16 MB string = ~12 MB binary
  if (clean.length > MAX_BASE64_CHARS) {
    throw new ApiError(400, 'Image payload exceeds the 16 MB base64 size limit.');
  }

  if (clean.length < 100 || !/^[A-Za-z0-9+/]+=*$/.test(clean)) {
    throw new ApiError(400, '"image_base64" is not a valid base64-encoded image.');
  }

  // Decode once to check the real byte size and magic bytes of the image.
  const binary = atob(clean);
  if (binary.length < 100) throw new ApiError(400, '"image_base64" is too small to be a photo.');
  if (binary.length > MAX_IMAGE_BYTES) {
    throw new ApiError(400, 'Image exceeds the 12 MB size limit.');
  }
  const isJpeg = binary.charCodeAt(0) === 0xff && binary.charCodeAt(1) === 0xd8 && binary.charCodeAt(2) === 0xff;
  const isPng = binary.charCodeAt(0) === 0x89 && binary.slice(1, 4) === 'PNG';
  if (!isJpeg && !isPng) {
    throw new ApiError(400, 'Image is not a valid JPEG/PNG (malformed or wrong format).');
  }

  return { imageBase64: clean, mimeType };
}

export async function handleRequest(req: Request): Promise<Response> {
  const cors = corsHeadersFor(req);
  // Responses carry the per-request CORS headers, so a disallowed browser origin
  // never receives an Access-Control-Allow-Origin.
  const jsonResponse = (body: unknown, status: number): Response =>
    jsonResponseWith(body, status, cors);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: { message: 'Method not allowed. Use POST.' } }, 405);
  }

  // ── Rate limiting ────────────────────────────────────────────────────────────
  // CF-Connecting-IP is set by Cloudflare (Supabase's CDN). Fallback to
  // x-forwarded-for, then 'unknown' so the bucket still increments safely.
  const clientIp =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown';
  if (await isRateLimited(`analyze-meal:${clientIp}`)) {
    return jsonResponse(
      { error: { message: 'Too many requests. Please wait a moment and try again.' } },
      429
    );
  }

  // ── Caller authorization (defense in depth) ─────────────────────────────────
  // `verify_jwt = true` (supabase/config.toml) rejects a missing, malformed or
  // wrongly-signed Authorization header, but it also accepts publishable/secret
  // API keys — which are not user sessions. Confirm the caller is a signed-in
  // user before any work happens, so anonymous or key-only callers are rejected.
  // https://supabase.com/docs/guides/functions/auth-headers
  try {
    authenticateRequest(req);
  } catch (err) {
    if (err instanceof ApiError) return jsonResponse({ error: { message: err.message } }, err.status);
    return jsonResponse({ error: { message: 'Authentication failed.' } }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed = await req.json();
    payload = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return jsonResponse({ error: { message: 'Request body must be valid JSON.' } }, 400);
  }

  let imageBase64: string;
  let mimeType: string;
  try {
    const extracted = extractImagePayload(payload);
    imageBase64 = extracted.imageBase64;
    mimeType = extracted.mimeType;
  } catch (err) {
    if (err instanceof ApiError) return jsonResponse({ error: { message: err.message } }, err.status);
    return jsonResponse({ error: { message: 'Invalid image payload.' } }, 400);
  }

  try {
    const items = await identifyFoodItems(imageBase64, mimeType);

    // No food detected is a valid result — not an error. Return clean zeros.
    if (items.length === 0) {
      return jsonResponse({ result: aggregate([]) }, 200);
    }

    // Parallelize FDC lookups (Promise.all) — a meal photo usually has 3-6 items.
    const resolved: ResolvedItem[] = await Promise.all(
      items.map(async (item) => {
        const nutrients = item.estimated_grams > 0 ? await lookupNutrition(item.name) : null;
        return resolveItem(item, nutrients);
      })
    );

    const anyMatched = resolved.some((item) => item.matched);
    if (!anyMatched) {
      // TOTAL FDC failure for every item (not a partial failure) — surface it
      // as an error so the user knows USDA lookups failed rather than seeing
      // an all-zeros meal.
      return jsonResponse(
        {
          error: {
            message:
              'USDA FoodData Central could not find matching nutrition data for any of the detected food items. Please try again.',
          },
        },
        502
      );
    }

    return jsonResponse({ result: aggregate(resolved) }, 200);
  } catch (err) {
    if (err instanceof ApiError) {
      return jsonResponse({ error: { message: err.message } }, err.status);
    }
    // Log the internal message server-side only — never expose stack traces in the response.
    console.error('[analyze-meal] Internal error:', err instanceof Error ? err.message : String(err));
    return jsonResponse({ error: { message: 'Unexpected server error while analyzing the meal.' } }, 500);
  }
}

// ── Entry point (Supabase Edge Runtime) ──────────────────────────────────────
// Guarded so tests can import this module's helpers without binding a port.
if (import.meta.main) {
  Deno.serve((req: Request) => handleRequest(req));
}