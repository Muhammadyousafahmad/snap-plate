import * as Haptics from 'expo-haptics';

/**
 * Haptic feedback vocabulary.
 *
 * Every call is fire-and-forget and swallows errors on purpose: haptics are
 * decoration, and on the web (Vibration API), in a simulator, or on a device
 * where the Taptic Engine is disabled (Low Power Mode, an active camera on iOS)
 * they can legitimately fail. A failed buzz must never break a press handler.
 *
 * Intensities follow the motion spec:
 * - `light`   — button presses, tab switches, swipe thresholds.
 * - `medium`  — shutter release, a goal being reached.
 * - `success` / `error` — the outcome of a save or a validation failure.
 */
function buzz(effect: () => Promise<void>): void {
  try {
    void effect().catch(() => undefined);
  } catch {
    // Missing vibration hardware / unsupported platform.
  }
}

/** Small, light collision — presses and tab changes. */
export function hapticLight(): void {
  buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Moderately sized collision — the shutter button, a completed goal. */
export function hapticMedium(): void {
  buzz(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Selection tick — used while dragging discrete values (portion slider). */
export function hapticSelection(): void {
  buzz(() => Haptics.selectionAsync());
}

/** Task completed successfully. */
export function hapticSuccess(): void {
  buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** A validation or network failure — pairs with the rose error states. */
export function hapticError(): void {
  buzz(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
