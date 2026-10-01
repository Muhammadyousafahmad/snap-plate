import { Platform } from 'react-native';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTH_CALLBACK_STORAGE_KEY = 'snapplate.authCallbackError';

/** Converts unknown thrown values into a useful message for an auth form. */
export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  const message = error.message.toLowerCase();
  if (message.includes('fetch') || message.includes('network') || message.includes('connect')) {
    return 'Could not reach Supabase. Check your internet connection and try again.';
  }
  if (message.includes('invalid login credentials')) {
    return 'The email or password is incorrect.';
  }
  if (message.includes('user already registered') || message.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (message.includes('email not confirmed')) {
    return 'Confirm your email address before signing in.';
  }
  if (message.includes('rate limit') || message.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  return error.message || fallback;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function getWebEmailRedirectTo(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  return `${window.location.origin}/login`;
}

/**
 * Captures an expired/error Supabase email-confirmation hash before the router
 * navigates away. Valid access-token hashes are intentionally left untouched so
 * Supabase can process them.
 */
export function captureWebAuthCallbackError(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  if (!rawHash) return null;

  const params = new URLSearchParams(rawHash);
  const errorCode = params.get('error_code');
  const errorDescription = params.get('error_description');
  if (!errorCode && !errorDescription) return null;

  let message = errorDescription?.replace(/\+/g, ' ') ?? 'Email confirmation failed.';
  if (errorCode === 'otp_expired') {
    message = 'This email confirmation link has expired. Request a new confirmation email.';
  } else if (errorCode === 'access_denied') {
    message = 'Email confirmation was denied or the link is invalid.';
  }

  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  try {
    window.sessionStorage.setItem(AUTH_CALLBACK_STORAGE_KEY, message);
  } catch {
    // The redirect still works; only the friendly persisted message is unavailable.
  }

  return message;
}

/** Reads and clears an error saved by the root auth callback handler. */
export function consumeWebAuthCallbackError(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  try {
    const message = window.sessionStorage.getItem(AUTH_CALLBACK_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_CALLBACK_STORAGE_KEY);
    return message;
  } catch {
    return null;
  }
}
