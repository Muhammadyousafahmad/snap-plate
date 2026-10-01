import { ApiError, type GeminiItem } from './types.ts';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Override with the GEMINI_MODEL secret.
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

/** Fallback models to use if the primary model fails or runs out of quota. */
const DEFAULT_GEMINI_FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite'];

/** Total time budget for all model attempts. */
const GEMINI_TOTAL_BUDGET_MS = 60_000;

/** Don't start another model attempt with less than this much budget left. */
const GEMINI_MIN_ATTEMPT_BUDGET_MS = 15_000;
// Max time allowed per model attempt.
const GEMINI_TIMEOUT_MS = 25_000;

const MAX_ESTIMATED_GRAMS = 2_000;
const MAX_ITEMS = 12;

// ── Gemini system prompt: identification + portion ONLY ──────────────────────

const GEMINI_SYSTEM_PROMPT = `You are a meal-photo analyzer. Given a photo of a meal, your ONLY job is to identify each distinct food item on the plate and estimate its portion size in grams. You must NOT calculate or guess any nutrition values.

Return a single valid JSON array of objects — one object per distinct food item — with EXACTLY these two fields:
[
  {
    "name": "specific, searchable food name in generic food-database phrasing, including variety and cooking state, e.g. 'Rice, brown, cooked', 'Chicken breast, grilled', 'Broccoli, steamed', 'Olive oil', 'Egg, fried'",
    "estimated_grams": <number - realistic portion weight in grams>
  }
]

RULES:
- Never include calories, protein, carbs, fat, or any other nutrition numbers inside the JSON. Nutrition values are computed separately by a USDA database lookup, and any numbers you emit are ignored.
- ALWAYS state how the food is prepared. Use the word "raw" when it is uncooked, or the cooking method when it is (steamed, boiled, fried, grilled, roasted, baked). A bare name like "Tofu" is ambiguous and matches the wrong USDA record — "Tofu, fried" is 270 kcal/100 g while plain tofu is about 76. Write "Tofu, raw, firm" or "Tofu, fried" instead, "Broccoli, steamed" instead of "Broccoli".
- Estimate grams from a normal home-cooked portion size.
- If no food is visible, return an empty array: []
- Valid JSON only. No markdown, no code fences, no commentary.`;

function readEnv(name: string): string | undefined {
  return Deno.env.get(name);
}

// ── Gemini: identify food items (never nutrition numbers) ────────────────────

export async function identifyFoodItems(imageBase64: string, mimeType: string): Promise<GeminiItem[]> {
  const apiKey = readEnv('GEMINI_API_KEY');
  if (!apiKey) throw new ApiError(500, 'GEMINI_API_KEY is not configured on the server.');
  const primaryModel = readEnv('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL;

  const requestBody = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          { text: GEMINI_SYSTEM_PROMPT },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      response_mime_type: 'application/json',
      responseSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            estimated_grams: { type: 'number' },
          },
          required: ['name', 'estimated_grams'],
        },
      },
    },
  });

  // Try models in order.
  const models = modelChain(primaryModel);
  const deadline = Date.now() + GEMINI_TOTAL_BUDGET_MS;
  const failures: Array<{ rateLimited: boolean; timedOut?: boolean; unreachable?: boolean; badPayload?: boolean }> = [];

  for (const model of models) {
    const remainingMs = deadline - Date.now();
    if (remainingMs < GEMINI_MIN_ATTEMPT_BUDGET_MS) {
      console.warn(`[analyze-meal] out of time budget before trying model "${model}".`);
      break;
    }

    const attempt = await identifyWithModel(model, apiKey, requestBody, Math.min(remainingMs, GEMINI_TIMEOUT_MS));
    if (attempt.ok) {
      if (model !== primaryModel) console.warn(`[analyze-meal] served by fallback model "${model}".`);
      return attempt.items;
    }
    failures.push(attempt);
  }

  // Handle model failures.
  if (failures.some((failure) => failure.rateLimited)) {
    throw new ApiError(
      429,
      'The food-identification service is rate limited (Gemini free-tier quota: about 20 requests per minute, plus a daily cap per model). Please wait a moment and try again.'
    );
  }
  if (failures.length > 0 && failures.every((failure) => failure.timedOut)) {
    throw new ApiError(504, 'The food-identification request timed out. Please try again.');
  }
  if (failures.some((failure) => failure.unreachable)) {
    throw new ApiError(502, 'The food-identification service is unreachable. Please check your connection and try again.');
  }
  // Handle case where models returned invalid JSON.
  if (failures.length > 0 && failures.every((failure) => failure.badPayload)) {
    throw new ApiError(502, 'The food-identification service returned an unreadable response. Please try again.');
  }
  throw new ApiError(502, 'The food-identification service is temporarily unavailable. Please try again.');
}

/** Returns a deduplicated list of models to try. */
function modelChain(primary: string): string[] {
  const configured = (readEnv('GEMINI_FALLBACK_MODELS') ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const fallbacks = configured.length > 0 ? configured : DEFAULT_GEMINI_FALLBACK_MODELS;

  return [...new Set([primary, ...fallbacks])];
}

type ModelAttempt =
  | { ok: true; items: GeminiItem[]; model: string }
  | { ok: false; rateLimited: boolean; timedOut?: boolean; unreachable?: boolean; badPayload?: boolean };

/** Executes a single model request, handling retries and errors. */
async function identifyWithModel(
  model: string,
  apiKey: string,
  requestBody: string,
  timeoutMs: number
): Promise<ModelAttempt> {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await requestGemini(url, requestBody, timeoutMs);
  } catch (err) {
    // Return soft failure to allow falling back to other models.
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    console.warn(`[analyze-meal] model "${model}" ${timedOut ? 'timed out' : 'was unreachable'}.`);
    return { ok: false, rateLimited: false, timedOut, unreachable: !timedOut };
  }

  if (!response.ok) {
    if (isRetryableStatus(response.status)) {
      console.warn(`[analyze-meal] model "${model}" unavailable (HTTP ${response.status}).`);
      return { ok: false, rateLimited: response.status === 429 };
    }
    const errJson = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    const detail = errJson?.error?.message;
    throw new ApiError(
      502,
      `The food-identification service returned an error (HTTP ${response.status})${detail ? `: ${detail}` : '.'}`
    );
  }

  const body = (await response.json().catch(() => null)) as
    | { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
    | null;
  const text = body?.candidates?.[0]?.content?.parts?.find((p) => typeof p?.text === 'string')?.text;
  if (!text) {
    console.warn(`[analyze-meal] model "${model}" returned no usable text.`);
    return { ok: false, rateLimited: false, badPayload: true };
  }

  // Soft failure for invalid JSON to allow fallbacks.
  let items: GeminiItem[];
  try {
    items = normalizeGeminiItems(parseGeminiItems(text));
  } catch {
    console.warn(`[analyze-meal] model "${model}" returned unparseable JSON.`);
    return { ok: false, rateLimited: false, badPayload: true };
  }

  return { ok: true, items, model };
}

/** Gemini request wrapper with short retries for transient rate limits. */
const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_MAX_RETRY_WAIT_MS = 8_000;

async function requestGemini(url: string, body: string, timeoutMs: number): Promise<Response> {
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!isRetryableStatus(response.status)) {
      return response;
    }

    const waitMs = await retryWaitMs(response, attempt);
    // Skip long retry waits (e.g., daily quota limits) to favor model fallbacks.
    if (waitMs > GEMINI_MAX_RETRY_WAIT_MS || attempt === GEMINI_MAX_ATTEMPTS) {
      return response;
    }

    console.warn(
      `[analyze-meal] Gemini responded HTTP ${response.status}; retry ${attempt}/${GEMINI_MAX_ATTEMPTS - 1}.`
    );
    await delay(waitMs);
  }

  // Unreachable: the loop always returns on its final attempt.
  throw new ApiError(502, 'The food-identification service is unavailable.');
}

/** 429 = rate limited; 500/503 = transient Google-side failure. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 503;
}

/** Parses the retry wait time from headers/body, falling back to backoff. */
async function retryWaitMs(response: Response, attempt: number): Promise<number> {
  const retryAfterSeconds = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  // Reading the body also releases the discarded response.
  const bodyText = await response.text().catch(() => '');
  const match = /retry in ([\d.]+)s/i.exec(bodyText);
  const hintedMs = match ? Number(match[1]) * 1000 : 0;
  const backoffMs = 500 * 2 ** (attempt - 1); // 500ms, 1s, 2s, ...

  return Math.max(hintedMs, backoffMs);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Defensive JSON parse: strips markdown fences, then scans for a JSON value. */
export function parseGeminiItems(text: string): unknown[] {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');
    try {
      if (arrStart >= 0 && arrEnd > arrStart) {
        parsed = JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
      } else if (objStart >= 0 && objEnd > objStart) {
        parsed = JSON.parse(cleaned.slice(objStart, objEnd + 1));
      } else {
        throw new ApiError(502, 'The food-identification response could not be parsed as JSON.');
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, 'The food-identification response could not be parsed as JSON.');
    }
  }

  if (Array.isArray(parsed)) return parsed as unknown[];
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as unknown[];
    const nested = Object.values(obj).find((value) => Array.isArray(value));
    if (nested) return nested as unknown[];
  }
  return [];
}

/** Coerces raw Gemini output into clean GeminiItem entries. */
export function normalizeGeminiItems(raw: unknown[]): GeminiItem[] {
  const items: GeminiItem[] = [];
  for (const entry of raw.slice(0, MAX_ITEMS)) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name.trim() : '';
    if (!name) continue;

    const rawGrams = Number(obj.estimated_grams ?? obj.grams ?? obj.portion_grams);
    const estimated_grams = Number.isFinite(rawGrams) && rawGrams > 0
      ? Math.min(Math.round(rawGrams), MAX_ESTIMATED_GRAMS)
      : 0;

    items.push({ name, estimated_grams });
  }
  return items;
}
