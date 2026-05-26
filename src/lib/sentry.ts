/**
 * Sentry stub — all functions are safe no-ops.
 * Sentry SDK was removed to fix Vercel build failures.
 * Re-install @sentry/nextjs and restore the real implementation if needed.
 */

/** Capture an exception (no-op). */
export function captureException(_error: unknown, _extra?: Record<string, unknown>): void {
  // no-op
}

/** Capture a manual message (no-op). */
export function captureMessage(_message: string, _level?: string, _extra?: Record<string, unknown>): void {
  // no-op
}

/** Set the currently authenticated user (no-op). */
export function setSentryUser(_user: {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  role?: string;
}): void {
  // no-op
}

/** Clear the user scope (no-op). */
export function clearSentryUser(): void {
  // no-op
}

/** Add a breadcrumb (no-op). */
export function addBreadcrumb(_breadcrumb: {
  category: string;
  message: string;
  level?: string;
  data?: Record<string, unknown>;
}): void {
  // no-op
}

/** Set a tag (no-op). */
export function setTag(_key: string, _value: string): void {
  // no-op
}

/** Set extra context data (no-op). */
export function setExtra(_key: string, _value: unknown): void {
  // no-op
}

/** Check whether Sentry is initialised — always false since SDK is removed. */
export function isSentryReady(): boolean {
  return false;
}
