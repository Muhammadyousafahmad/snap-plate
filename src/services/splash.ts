import * as SplashScreen from 'expo-splash-screen';
import { Platform } from 'react-native';

/**
 * Native splash handoff.
 *
 * The OS splash (configured in `app.json`) and the animated JS splash are two
 * different screens. Without this handshake the native one auto-hides the moment
 * the bundle loads, which can flash an empty canvas before the first JS frame
 * paints. Holding it and releasing it on the first commit makes the two read as
 * a single continuous boot sequence.
 *
 * `preventAutoHideAsync` must be called in global scope (see `src/app/_layout.tsx`)
 * — calling it from inside a component is documented to sometimes run too late.
 * Web has no native splash, so both helpers are no-ops there.
 */
export function holdNativeSplash(): void {
  if (Platform.OS === 'web') return;
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
}

/** Releases the native splash so the animated splash is the visible surface. */
export function releaseNativeSplash(): void {
  if (Platform.OS === 'web') return;
  void SplashScreen.hideAsync().catch(() => undefined);
}
