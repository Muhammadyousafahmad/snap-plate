/**
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time.
 * This declaration gives TypeScript a typed `process.env` without needing @types/node.
 */
declare const process: {
  env: Record<string, string | undefined>;
};