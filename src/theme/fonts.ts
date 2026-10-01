import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';

/**
 * Loads the app's two typefaces: DM Serif Display (editorial display numerals)
 * and Inter (UI text with excellent tabular figures).
 *
 * Returns `true` once all fonts are ready. The root layout gates the navigator
 * on this flag so no screen renders with system-fallback type.
 */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    DMSerifDisplay_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  return loaded;
}
