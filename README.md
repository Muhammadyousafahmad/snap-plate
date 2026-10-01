# 📸 SnapPlate — AI Food Nutrition Scanner

**SnapPlate** is a camera-first mobile app built with **React Native (Expo)** and **Expo Router**.
Snap a photo of your meal, and a multimodal AI instantly estimates its **calories, protein,
carbs, and fat** — with an itemized breakdown of what was detected.

> Built with NativeWind (Tailwind), Zustand, TanStack Query, Expo Camera, and a Supabase Edge
> Function that pairs Gemini vision (identification only) with USDA FoodData Central (nutrition).

## ✨ Features

- 📷 **Live camera scanner** with a shutter button, camera flip, and a guided capture frame
- 🖼️ **Gallery mode** — pick any meal photo from your library
- 🤖 **AI analysis** through the `analyze-meal` backend: Gemini identifies the food items and
  estimates portions, then USDA FoodData Central supplies the calories/macros (never the model)
- 📊 Results screen: total calories, macro tiles, macro breakdown bars, and detected items
- 💾 **Cached results** — the last scan is saved and shown on the home screen
- 🌙 Sleek dark-mode UI styled with NativeWind (Tailwind CSS)

## 🚀 Getting started

```bash
npm install
npx expo start
```

Press `w` for web, `a` for Android, `i` for iOS, or scan the QR code with **Expo Go** on your phone.

## 🔑 Adding real AI analysis

Nutrition numbers are computed by the **`analyze-meal` Edge Function** in
[`supabase/functions/analyze-meal`](./supabase/functions/analyze-meal) — the app never calls an AI
API directly and holds no API keys.

The function reads two secrets (`GEMINI_API_KEY`, `USDA_FDC_API_KEY`); see
[`supabase/functions/analyze-meal/.env.example`](./supabase/functions/analyze-meal/.env.example).

### Run it locally (no Docker needed)

```bash
# 1. Put the two real keys in supabase/functions/.env
copy supabase\functions\analyze-meal\.env.example supabase\functions\.env

# 2. Start the function (binds 0.0.0.0:8000, so phones can reach it over the LAN)
deno run --allow-net --allow-env --env-file=supabase/functions/.env supabase/functions/analyze-meal/index.ts

# 3. Start the app
npx expo start -c
```

**No URL configuration is required.** `src/services/ai.ts` derives the backend address from the
Metro dev-server host the bundle was loaded from, so the same build works over Wi-Fi, a phone
hotspot, an emulator, or the web — without editing `.env` when you change networks. Leave
`EXPO_PUBLIC_API_URL` empty for that behaviour, or set it to override:

```bash
# .env  (optional override — e.g. once deployed)
EXPO_PUBLIC_API_URL=https://<project-ref>.supabase.co/functions/v1/analyze-meal
```

If no server can be resolved (for example a production build with nothing configured), the app
falls back to **Demo mode** so the UI always renders.

### Deploy

```bash
supabase secrets set GEMINI_API_KEY=... USDA_FDC_API_KEY=...
supabase functions deploy analyze-meal
```

### Edge Function security

- **CORS** — the function reflects the request's `Origin` only when it is listed in the
  `ALLOWED_ORIGINS` secret (comma-separated). Native requests send no `Origin` and are
  unaffected, so set the web build's origin in production:
  `supabase secrets set ALLOWED_ORIGINS=https://your-web-app.example.com`.
- **Rate limiting** — requests are throttled (10/min per client) through a shared
  `check_rate_limit` Postgres function, so the limit holds across every Edge Function
  replica. The in-memory fallback runs only when the service-role key is unavailable
  (local `deno run`).

## 🗂️ Project structure

```
src/
├── app/
│   ├── _layout.tsx     # Root layout (QueryClient + theme providers)
│   ├── index.tsx       # Home screen ("Scan Meal" CTA + last scan)
│   ├── scanner.tsx     # Live camera + gallery capture
│   └── results.tsx     # Nutrition breakdown & detected items
├── services/
│   └── ai.ts           # AI service layer (backend/demo + NutritionResult types)
├── store/
│   └── nutrition-store.ts  # Zustand store (pending image, cached results)
└── global.css          # Tailwind entry
```

## 🧠 API contract

The app POSTs `{ "image_base64": "...", "mime_type": "image/jpeg" }` to the backend and expects
`{ "result": NutritionResult }` back (or a non-2xx status with `{ "error": { "message": "..." } }`):

```ts
interface NutritionResult {
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  items_detected: Array<{
    name: string;
    portion: string;      // human-readable, e.g. "150 g"
    calories: number;
    protein_g: number;
    carbs_g?: number;
    fat_g?: number;
    original_grams?: number; // immutable Gemini estimate used for recalculation
    calories_per_100g?: number;
    protein_per_100g?: number;
    carbs_per_100g?: number;
    fat_per_100g?: number;
    matched?: boolean;    // false when USDA had no good match (numbers are then 0)
  }>;
}
```

Inside the function the two AI concerns are deliberately separated:

1. **Gemini** (vision) returns only `[{ name, estimated_grams }]` — it is explicitly instructed
   never to invent calories or macros.
2. **USDA FoodData Central** supplies the nutrition: per-100 g values are read by nutrient **ID**
   (Energy `1008`, Protein `1003`, Carbohydrate `1005`, Fat `1004`) and scaled by `estimated_grams / 100`.

## 🛠️ Commands

| Command            | Description               |
| ------------------ | ------------------------- |
| `npm run start`    | Start the Expo dev server |
| `npm run android`  | Start + open Android      |
| `npm run ios`      | Start + open iOS simulator|
| `npm run web`      | Start + open web          |
| `npm run lint`     | Run ESLint                |
