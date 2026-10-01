/**
 * SnapPlate — caller authorization for the analyze-meal Edge Function.
 *
 * The platform's `verify_jwt = true` check (supabase/config.toml) runs before
 * this code. It rejects a missing, malformed or wrongly-signed `Authorization`
 * header — but it ALSO lets publishable/secret API keys through on that header,
 * and an API key is not a user session. So the platform check alone does not
 * authenticate a key-only caller; the function has to confirm for itself that
 * the caller sent a real signed-in user's access token before it does any work.
 *
 * https://supabase.com/docs/guides/functions/auth-headers
 */

import { ApiError } from './types.ts';

/** The caller identity this function needs: the authenticated user's id. */
export interface AuthenticatedUser {
  userId: string;
}

/** Reads the raw bearer token from the `Authorization` header, if present. */
export function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/**
 * Decodes the payload (2nd segment) of a JWT. The signature is not checked here
 * on purpose: the platform's verify_jwt layer already rejected any token whose
 * signature it could not verify, so this only needs to read the claims and
 * confirm the credential is a user token rather than an API key.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Ensures the request carries a signed-in user's access token and returns the
 * caller's user id. Throws `ApiError(401)` for anything else — a missing header,
 * an API key sent as a bearer token, an anonymous (`anon`) token, a token with no
 * user id, or an expired session.
 */
export function authenticateRequest(req: Request): AuthenticatedUser {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiError(401, 'Authentication required: sign in and try again.');
  }

  const claims = decodeJwtPayload(token);
  if (!claims) {
    // Not a JWT at all — e.g. a publishable/secret API key sent in the
    // Authorization header instead of the `apikey` header.
    throw new ApiError(401, 'Authentication required: a user access token is required.');
  }

  if (claims.role === 'anon') {
    throw new ApiError(401, 'Authentication required: anonymous access is not allowed.');
  }

  const userId = typeof claims.sub === 'string' ? claims.sub : undefined;
  if (!userId) {
    throw new ApiError(401, 'Authentication required: the access token has no user id.');
  }

  if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) {
    throw new ApiError(401, 'Authentication required: the session has expired. Sign in again.');
  }

  return { userId };
}
