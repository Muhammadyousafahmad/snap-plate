import { ApiError, type FdcFood, type FdcNutrients, type FdcSearchResponse } from './types.ts';

const FDC_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const FDC_TIMEOUT_MS = 15_000;
// Prefer generic whole-food entries over branded packaged foods.
const FDC_PREFERRED_TYPES = ['Foundation', 'SR Legacy'];
const FDC_PAGE_SIZE = 5;

// USDA nutrient IDs (Energy, Protein, Carbs, Fat)
const NUTRIENT_IDS = { energyKcal: 1008, protein: 1003, carbs: 1005, fat: 1004 } as const;

// Fallback nutrient IDs for Energy (Atwater Factors) if 1008 is missing.
const ENERGY_NUTRIENT_IDS = [NUTRIENT_IDS.energyKcal, 2047, 2048] as const;

// ── In-memory FDC cache ──────────────────────────────────────────────────────
// In-memory Promise cache keyed by food name to avoid redundant FDC calls.
const fdcCache = new Map<string, Promise<FdcNutrients | null>>();

function readEnv(name: string): string | undefined {
  return Deno.env.get(name);
}

// ── USDA FoodData Central lookup ─────────────────────────────────────────────

/** One FDC search attempt. Returns null on any failure (network/API/parse). */
export async function searchFdc(query: string, dataTypes: string[] | null): Promise<FdcSearchResponse | null> {
  const apiKey = readEnv('USDA_FDC_API_KEY');
  if (!apiKey) throw new ApiError(500, 'USDA_FDC_API_KEY is not configured on the server.');

  const params = new URLSearchParams({
    api_key: apiKey,
    query,
    // Do not use requireAllWords to allow partial word matching.
    pageSize: String(FDC_PAGE_SIZE),
  });
  if (dataTypes && dataTypes.length > 0) {
    params.set('dataType', dataTypes.join(','));
  }

  let response: Response;
  try {
    response = await fetch(`${FDC_SEARCH_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FDC_TIMEOUT_MS),
    });
  } catch {
    console.error('[analyze-meal] FDC request failed (network error or timeout).');
    return null;
  }

  if (!response.ok) {
    console.error(`[analyze-meal] FDC returned HTTP ${response.status}.`);
    return null;
  }

  const json = (await response.json().catch(() => null)) as FdcSearchResponse | null;
  if (!json || !Array.isArray(json.foods)) return null;
  return json;
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'the', 'for', 'of', 'with', 'in', 'on', 'or', 'to', '&', 'plus', 'vs', 'x',
]);

// Words indicating a processed product, used to reject matches for whole ingredients.
const PROCESSED_HINT_WORDS = new Set([
  'flour', 'crackers', 'cracker', 'cakes', 'cake', 'snacks', 'snack', 'chips',
  'chip', 'bars', 'bar', 'bowl', 'crunch', 'mixes', 'mix', 'meal',
  // Milling/refining fractions.
  'bran', 'germ', 'starch',
]);

// Markers that a record is the raw or dry form of an ingredient.
const RAW_FORM_WORDS = new Set([
  'raw', 'uncooked', 'unprepared', 'dry', 'dried', 'dehydrated', 'grain', 'grains',
]);

// Cooking states used to detect that the query and the record agree.
const STATE_WORDS = new Set([
  'cooked', 'boiled', 'fried', 'grilled', 'baked', 'roasted', 'steamed',
  'sauteed', 'broiled', 'poached', 'simmered', 'pan-fried', 'panfried',
  'stir-fried', 'stirfried', 'hard-boiled', 'hardboiled',
]);

// Tokens that describe preparation or color.
const OPTIONAL_WORDS = new Set([
  ...STATE_WORDS,
  ...RAW_FORM_WORDS,
  'fresh', 'ripe', 'frozen', 'canned', 'prepared', 'drained', 'salted',
  'unsalted', 'salt', 'sweet', 'firm', 'soft', 'whole', 'part', 'pieces',
  'piece', 'slices', 'slice', 'chopped', 'shredded', 'minced', 'leaf', 'leaves',
  'kernels', 'kernel', 'florets', 'spears', 'large', 'small', 'medium', 'young',
  'mature', 'baby', 'shelled', 'unshelled', 'green', 'red', 'white', 'yellow',
  'brown', 'orange', 'purple', 'black', 'golden',
  // USDA statistical filler.
  'year', 'round', 'average',
  // USDA boilerplate text.
  'includes', 'include', 'food', 'foods', 'distribution', 'program', 'programs',
  "usda's",
]);

// A name that already states its cooking/ripeness state won't get " cooked"
// appended by the fallback query below.
const COOKING_STATE_RE = /cooked|grilled|baked|roasted|steamed|fried|boiled|sauteed|broiled|poached|raw|fresh|ripe/i;

/** Lowercases, strips punctuation, and removes stopwords. */
export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^['-]+|['-]+$/g, ''))
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

/** Loose English singular/plural-insensitive word equality. */
function wordsEqual(a: string, b: string): boolean {
  if (a === b) return true;
  // Hyphenated compounds agree with their parts: "hard-boiled" ~ "boiled",
  // "pan-fried" ~ "fried", "stir-fried" ~ "fried".
  const aParts = a.split('-');
  const bParts = b.split('-');
  if ((aParts.length > 1 || bParts.length > 1) && aParts.some((part) => part.length > 0 && bParts.includes(part))) {
    return true;
  }
  if (a.endsWith('ies') && a.slice(0, -3) + 'y' === b) return true;
  if (b.endsWith('ies') && b.slice(0, -3) + 'y' === a) return true;
  if (a.endsWith('es') && a.slice(0, -2) === b) return true;
  if (b.endsWith('es') && b.slice(0, -2) === a) return true;
  if (a.endsWith('s') && a.slice(0, -1) === b) return true;
  if (b.endsWith('s') && b.slice(0, -1) === a) return true;
  return false;
}

/**
 * Scores how well an FDC food description matches the Gemini item name.
 * Returns a value above ACCEPT_SCORE, or -Infinity to reject the record
 * outright (processed product, raw/dry form of an unqualified query, or a
 * description that shares only descriptors with the query).
 */
export function foodScore(queryTokens: string[], food: FdcFood, allowRaw = false): number {
  const descTokens = tokenize(food.description);
  if (descTokens.length === 0) return -Infinity;

  const descHas = (word: string) => descTokens.some((t) => wordsEqual(t, word));
  const queryStates = queryTokens.filter((t) => STATE_WORDS.has(t));
  // Allow raw markers if the query explicitly asks for raw.
  const queryAsksForRaw = queryTokens.some((t) => RAW_FORM_WORDS.has(t));

  // Allow processed markers if the query explicitly asks for processed.
  const queryAsksForProcessed = queryTokens.some((t) => PROCESSED_HINT_WORDS.has(t));

  // 1. Hard-reject processed products if not requested.
  if (!queryAsksForProcessed && descTokens.some((t) => PROCESSED_HINT_WORDS.has(t))) return -Infinity;

  // 2. Hard-reject raw records for cooked queries unless allowed.
  const descHasRawMarker = descTokens.some((t) => RAW_FORM_WORDS.has(t));
  const rawUnrequested = descHasRawMarker && queryStates.length === 0 && !queryAsksForRaw;
  if (rawUnrequested && !allowRaw) return -Infinity;

  // Calculate unique matched query tokens.
  const matchedQueryTokens = queryTokens.filter((qt) => descTokens.some((dt) => wordsEqual(qt, dt)));
  if (matchedQueryTokens.length === 0) return -Infinity;

  // 3. Require a real food word to match.
  const coreTokens = queryTokens.filter((t) => !OPTIONAL_WORDS.has(t));
  if (coreTokens.length > 0 && !coreTokens.some((t) => descHas(t))) return -Infinity;

  // Food-identity coverage measured over non-state tokens.
  const identityTokens = queryTokens.filter((t) => !STATE_WORDS.has(t));
  const coverage =
    identityTokens.length === 0
      ? 0
      : identityTokens.filter((qt) => descTokens.some((dt) => wordsEqual(qt, dt))).length / identityTokens.length;
  // How much of the record's own description the query accounts for — keeps
  // tightly-named records ahead of sprawling ones.
  const descCoverage = matchedQueryTokens.length / descTokens.length;
  // Penalize descriptions with unrelated tokens (composite products).
  const foreignTokens = descTokens.filter(
    (t) => !queryTokens.some((qt) => wordsEqual(qt, t)) && !OPTIONAL_WORDS.has(t)
  );
  const compositePenalty = listedAsSynonym(food.description, queryTokens)
    ? 0
    : -0.5 * (foreignTokens.length / descTokens.length);
  // Bonus when description starts with a query word.
  const leadsWithQueryWord = queryTokens.some((qt) => wordsEqual(qt, descTokens[0]));
  // Bonus if all query words appear in the description.
  const fullyCovered = matchedQueryTokens.length === queryTokens.length;
  // Reward agreement / mildly penalise contradiction of the cooking state.
  const descStates = descTokens.filter((t) => STATE_WORDS.has(t));
  const statesAgree = queryStates.some((qt) => descStates.some((dt) => wordsEqual(qt, dt)));
  const rawAgrees = queryAsksForRaw && descHasRawMarker;
  const stateAdjustment = statesAgree || rawAgrees ? 0.05 : queryStates.length > 0 && descHasRawMarker ? -0.1 : 0;
  // Penalize branded products slightly to favor generic entries.
  const brandedPenalty = food.dataType === 'Branded' ? -0.15 : 0;
  // Small penalty for raw records when a cooked state was not specified.
  const rawPenalty = rawUnrequested ? -0.05 : 0;

  return (
    coverage * 0.35 +
    descCoverage * 0.15 +
    (leadsWithQueryWord ? 0.35 : 0) +
    (fullyCovered && !leadsWithQueryWord ? 0.25 : 0) +
    stateAdjustment +
    brandedPenalty +
    rawPenalty +
    compositePenalty
  );
}

/** Matches if a query token appears as a synonym in the description (e.g. "or scallions"). */
function listedAsSynonym(description: string, queryTokens: string[]): boolean {
  return queryTokens.some((token) => {
    const word = token.replace(/[^a-z0-9-]/gi, '');
    if (word.length < 3) return false;
    // Allows a short suffix so "scallion" also matches "scallions".
    return new RegExp(`(?:\\bor\\s+${word}\\w{0,3}\\b|\\b${word}\\w{0,3}\\s+or\\b)`, 'i').test(description);
  });
}

/** Minimum score an FDC record must reach to be trusted (see foodScore). */
const ACCEPT_SCORE = 0.45;

/** Returns the best-scoring FDC food, or null when nothing clears the bar. */
export function pickBestFood(foods: FdcFood[] | undefined, queryTokens: string[], allowRaw = false): FdcFood | null {
  if (!foods || foods.length === 0) return null;
  let best: FdcFood | null = null;
  let bestScore = ACCEPT_SCORE;
  for (const food of foods) {
    const score = foodScore(queryTokens, food, allowRaw);
    if (score > bestScore) {
      bestScore = score;
      best = food;
    }
  }
  return best;
}

/** Pulls per-100 g values by USDA nutrient ID (not by name string). */
function extractNutrients(food: FdcFood): FdcNutrients {
  const valuesByNutrientId = new Map<number, number>();
  for (const nutrient of food.foodNutrients ?? []) {
    if (typeof nutrient.value === 'number' && Number.isFinite(nutrient.value)) {
      valuesByNutrientId.set(nutrient.nutrientId, nutrient.value);
    }
  }
  const grab = (nutrientIds: readonly number[]): number => {
    for (const nutrientId of nutrientIds) {
      const value = valuesByNutrientId.get(nutrientId);
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return 0;
  };
  return {
    caloriesPer100g: grab(ENERGY_NUTRIENT_IDS),
    proteinPer100g: grab([NUTRIENT_IDS.protein]),
    carbsPer100g: grab([NUTRIENT_IDS.carbs]),
    fatPer100g: grab([NUTRIENT_IDS.fat]),
  };
}

/**
 * Full lookup strategy for one food name:
 * 1. Exact search (Foundation + SR Legacy)
 * 2. Search with " cooked" appended
 * 3. Relaxed search allowing raw entries
 * 4. Unfiltered search (includes Branded foods)
 */
async function lookupNutritionProto(name: string): Promise<FdcNutrients | null> {
  const queryTokens = tokenize(name);
  if (queryTokens.length === 0) return null;

  const attempts: Array<{ query: string; dataTypes: string[] | null; allowRaw?: boolean }> = [
    { query: name, dataTypes: FDC_PREFERRED_TYPES },
  ];
  if (!COOKING_STATE_RE.test(name)) {
    attempts.push({ query: `${name} cooked`, dataTypes: FDC_PREFERRED_TYPES });
  }
  attempts.push({ query: name, dataTypes: FDC_PREFERRED_TYPES, allowRaw: true });
  attempts.push({ query: name, dataTypes: null, allowRaw: true });

  for (const attempt of attempts) {
    const result = await searchFdc(attempt.query, attempt.dataTypes);
    const best =
      result === null ? null : pickBestFood(result.foods, tokenize(attempt.query), attempt.allowRaw === true);
    if (best !== null) return extractNutrients(best);
  }
  return null;
}

/** Cached wrapper around lookupNutritionProto. */
export function lookupNutrition(name: string): Promise<FdcNutrients | null> {
  const key = name.trim().toLowerCase();
  let pending = fdcCache.get(key);
  if (pending === undefined) {
    pending = lookupNutritionProto(name).catch((err: unknown) => {
      fdcCache.delete(key);
      throw err;
    });
    fdcCache.set(key, pending);
  }
  return pending;
}
