"use client";

/**
 * Client-side session presence indicator (UYE-P5, İRİS A14).
 *
 * Stores NO tokens, NO secrets, and NO PII (purely an unprivileged presence flag).
 * Holds `cg_has_session=1` in `document.cookie` when a session is active,
 * allowing `useAuthSession` to avoid querying `/api/auth/session` on anonymous visits
 * (preventing 401 console noise without silencing errors).
 */

export const SESSION_FLAG_COOKIE_NAME = "cg_has_session";

/**
 * Checks whether the session presence indicator is set.
 * In a browser environment, inspects `document.cookie`.
 * In a node test environment where `document` is undefined, defaults to `true`
 * so existing node-only test harnesses run their fetch mocks unchanged.
 */
export function hasSessionFlag(cookieSource?: string): boolean {
  if (cookieSource !== undefined) {
    return /(?:^|;\s*)cg_has_session=1(?:\s*;|$)/.test(cookieSource);
  }
  if (typeof document === "undefined") {
    return true;
  }
  return /(?:^|;\s*)cg_has_session=1(?:\s*;|$)/.test(document.cookie);
}

/**
 * Sets the presence flag when an authenticated session is confirmed.
 */
export function setSessionFlag(): void {
  if (typeof document !== "undefined") {
    document.cookie = `${SESSION_FLAG_COOKIE_NAME}=1; path=/; samesite=lax; max-age=2592000`;
  }
}

/**
 * Clears the presence flag on logout or when `/api/auth/session` reports unauthenticated.
 */
export function clearSessionFlag(): void {
  if (typeof document !== "undefined") {
    document.cookie = `${SESSION_FLAG_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  }
}
