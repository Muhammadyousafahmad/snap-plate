# SnapPlate — Visual System & Design Specification

The design language of SnapPlate is **"Warm Editorial"**: an opinionated, food-first aesthetic that rejects generic AI dark dashboards. Instead of cold neon-cyan accents and repetitive boxy cards, SnapPlate uses a warm charcoal base (`#1A1814`) that makes food photography pop, complemented by an organic burnt orange accent (`#E8722A`) and an editorial type pairing of DM Serif Display and Inter.

This document is the contract between design and engineering. The tokens in `src/theme/tokens.ts` and the semantic Tailwind classes in `tailwind.config.js` are the single source of truth.

---

## 1. Color System

| Semantic Role | Token (`tokens.ts`) | Tailwind Class | Value | Purpose |
| --- | --- | --- | --- | --- |
| Canvas | `palette.canvas` | `bg-canvas` | `#1A1814` | Warm near-black page background across all screens |
| Canvas Sunken | `palette.canvasSunken` | `bg-canvas-sunken` | `#13110E` | Modals, bottom sheets, backdrop scrims |
| Surface | `palette.surface` | `bg-surface` | `#252220` | Primary cards, panels, and containers |
| Surface Raised | `palette.surfaceRaised` | `bg-surface-raised` | `#302C29` | Interactive cards, raised badges, button states |
| Surface Sunken | `palette.surfaceSunken` | `bg-surface-sunken` | `#1F1C19` | Inset wells, progress tracks, text inputs |
| Border | `palette.border` | `border-subtle` / `border-line` | `#302C29` | Hairline card boundaries |
| Border Strong | `palette.borderStrong` | `border-subtle-strong` | `#3D3834` | Focus borders, active inputs, separators |
| Primary Accent | `palette.accent` | `bg-accent` / `text-accent` | `#E8722A` | Burnt orange primary CTAs, active highlights |
| Accent Light | `palette.accentLight` | `bg-accent-light` | `#F08A4A` | Hover & pressed states for primary buttons |
| Accent Ink | `palette.accentInk` | `text-accent-ink` | `#FFFFFF` | High-contrast label color on accent backgrounds |
| Macro: Protein | `palette.protein` | `text-macro-protein` / `bg-macro-protein` | `#D4A24C` | Golden amber |
| Macro: Carbs | `palette.carbs` | `text-macro-carbs` / `bg-macro-carbs` | `#7BADE2` | Soft sky blue |
| Macro: Fat | `palette.fat` | `text-macro-fat` / `bg-macro-fat` | `#C97BB2` | Warm mauve |
| Positive | `palette.positive` | `text-positive` / `bg-positive` | `#4CAF82` | Sage green success badges and confirmations |
| Warning | `palette.warning` | `text-warning` / `bg-warning` | `#D4A24C` | Amber streak indicators, unverified warnings |
| Danger | `palette.danger` | `text-danger` / `bg-danger` | `#D4513F` | Destructive actions, over-goal alerts |
| Text Primary | `palette.textPrimary` | `text-warm-primary` | `#F5F0EB` | Primary headlines and high-emphasis numbers |
| Text Secondary | `palette.textSecondary` | `text-warm-secondary` | `#A8A09A` | Subtitles and descriptive text |
| Text Tertiary | `palette.textTertiary` | `text-warm-tertiary` | `#6E6862` | Micro-copy, timestamps, and metadata |

---

## 2. Typography

SnapPlate pairs an editorial serif with a high-legibility sans-serif:

- **Display Face: DM Serif Display (`font-display`)**
  - Used for hero calorie values, screen titles, and section headlines.
  - Distinctive serif numerals feel tactile and culinary rather than clinical.
- **Text Face: Inter (`font-sans`, `font-sans-medium`, `font-sans-bold`)**
  - Used for body copy, buttons, labels, and tabular macro metrics.
  - Tabular digits prevent number jitter during animations.

### Scale

| Level | Size | Weight | Font | Usage |
| --- | --- | --- | --- | --- |
| Hero | 44–48pt | 400 | DM Serif Display | Today's calorie count, meal results energy |
| Display | 24–32pt | 400 | DM Serif Display | Screen titles ("Today's Plate", "History") |
| Title | 18–20pt | Bold (700) | Inter | Card headers, modal headlines |
| Subtitle | 15–16pt | SemiBold (600) | Inter | Food item names, subsection headers |
| Body | 14–15pt | Regular (400) | Inter | Explanatory copy, input values |
| Caption | 11–12pt | Medium (500) | Inter | Metadata, timestamps, nutritional units |

---

## 3. Shape Hierarchy

Three radii establish consistent container depth:

- **Card (`rounded-card` = 20pt)**: Primary content surfaces, hero charts, and modal sheets.
- **Panel (`rounded-panel` = 16pt)**: Secondary grouped items and food cards.
- **Inner (`rounded-inner` = 12pt)**: Interactive elements, text inputs, and action buttons.
- **Pill (`rounded-pill` = 999px)**: Tags, macro chips, status badges, and streak counters.

---

## 4. Motion & Haptics

SnapPlate uses purposeful, organic transitions:

- **`spring.fill` (`{damping: 26, stiffness: 150}`)**: Progress bars settle exactly on target without overshooting.
- **`spring.reveal` (`{damping: 20, stiffness: 180}`)**: Inline portion editor expansions.
- **`AnimatedNumber`**: Recalculated values count smoothly over 900ms.
- **Haptics**:
  - `hapticLight()`: Tab switches, card expansions, nudge steps.
  - `hapticSuccess()`: Meal saved to history, daily goals updated.
  - `hapticError()`: Failed uploads or network drops.

---

## 5. Screen Patterns & UX Principles

1. **Food Photos are the Hero**:
   - Every history card and dashboard meal row displays a high-quality thumbnail (`MealImage`).
   - Photos are never hidden behind abstract clock or document icons.
2. **Distinctive Screen Headers**:
   - Removed generic camera-in-a-box headers.
   - Headers are contextual: personalized greeting and live streak badge on Home, journal headline on History, viewfinder tools on Camera.
3. **Streamlined Capture**:
   - The primary Scan button in the bottom tab bar floats in burnt orange and opens the live camera directly.
   - The Capture Studio provides quick switching between live viewfinder and photo library with photography guidance.
4. **Transparent Nutritional Audit**:
   - Detailed USDA match indicators and portion weights are expandable on every recorded meal.
