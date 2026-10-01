import { Alert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

/**
 * Cross-platform alert.
 *
 * react-native-web ships `Alert.alert` as a no-op (`static alert() {}`), which
 * silently swallows every confirmation and error dialog on the web — e.g. the
 * sign-out confirmation never appears and the button looks broken. Native keeps
 * the platform alert; the browser falls back to `window.alert` / `window.confirm`.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  if (typeof window === 'undefined') return;

  const content = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length === 0) {
    window.alert(content);
    return;
  }

  if (buttons.length === 1) {
    window.alert(content);
    buttons[0].onPress?.();
    return;
  }

  // Map a two-button alert onto window.confirm: OK runs the primary action
  // (the last non-cancel button), Cancel runs the cancel button if it has one.
  const cancelIndex = buttons.findIndex((button) => button.style === 'cancel');
  const actionButtons = buttons.filter((_, index) => index !== cancelIndex);
  const action = actionButtons[actionButtons.length - 1];
  const cancel = cancelIndex >= 0 ? buttons[cancelIndex] : undefined;

  if (window.confirm(content)) {
    action?.onPress?.();
  } else {
    cancel?.onPress?.();
  }
}
