/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      /*
       * Semantic colour names for the SnapPlate warm-editorial palette.
       *
       * These mirror `src/theme/tokens.ts` (kept in sync by hand so that this
       * CommonJS config stays dependency-free). Every screen uses these tokens
       * instead of inline hex values.
       */
      colors: {
        /** Page background — warm near-black. */
        canvas: { DEFAULT: '#1A1814', sunken: '#13110E' },
        /** Warm charcoal cards, nested surfaces and inset wells. */
        surface: { DEFAULT: '#252220', raised: '#302C29', sunken: '#1F1C19' },
        /** Subtle hairline borders: `subtle` for cards, `strong` for inputs. */
        subtle: { DEFAULT: '#302C29', strong: '#3D3834' },
        line: '#302C29',
        /** Primary accent — burnt orange. */
        accent: {
          DEFAULT: '#E8722A',
          light: '#F08A4A',
          muted: 'rgba(232, 114, 42, 0.1)',
          ink: '#FFFFFF',
        },
        /** Functional colours. */
        positive: '#4CAF82',
        warning: '#D4A24C',
        danger: '#D4513F',
        /** Macro colours — warm palette–harmonised. */
        macro: {
          protein: '#D4A24C',
          carbs: '#7BADE2',
          fat: '#C97BB2',
        },
        /** Warm text ramp. */
        warm: {
          primary: '#F5F0EB',
          secondary: '#A8A09A',
          tertiary: '#6E6862',
        },
      },
      borderRadius: {
        /** 20pt cards, 12pt inner elements (buttons/inputs), pill for chips. */
        card: '20px',
        panel: '16px',
        inner: '12px',
        pill: '999px',
      },
      fontFamily: {
        display: ['DMSerifDisplay_400Regular'],
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
        'sans-bold': ['Inter_700Bold'],
      },
      spacing: {
        '13': '52px',
        '14': '56px',
        '15': '60px',
        '18': '72px',
        '22': '88px',
      },
    },
  },
  plugins: [],
};