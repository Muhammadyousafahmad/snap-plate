import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

/**
 * Shared layout helpers that keep the web build looking like the iOS app.
 *
 * - `topInset` / `bottomInset`: `useSafeAreaInsets()` reports 0 on web (no
 *   notch, no home indicator) while iOS reports ~50-60pt. Giving the browser a
 *   small fixed inset stops headers from hugging the viewport edge and keeps
 *   spacing closer to the phone.
 * - `sheetStyle`: modals are portalled to the document body on web, so without
 *   a cap a bottom sheet would stretch across a whole desktop window instead
 *   of staying phone-width (430pt max) like the app shell.
 */
export const sheetStyle: StyleProp<ViewStyle> = {
  width: '100%',
  maxWidth: 430,
  alignSelf: 'center',
  marginLeft: 'auto',
  marginRight: 'auto',
};

export function topInset(insets: EdgeInsets): number {
  if (Platform.OS !== 'web') return insets.top;
  return Math.max(insets.top, 16);
}

export function bottomInset(insets: EdgeInsets): number {
  if (Platform.OS !== 'web') return insets.bottom;
  return Math.max(insets.bottom, 16);
}