/**
 * Shared Sentry utilities for the MartUp project.
 *
 * All functions are safe no-ops when the Sentry DSN is not configured,
 * so the app works identically in development without a DSN.
 */
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isSentryEnabled = !!SENTRY_DSN;

/** Capture an exception and send it to Sentry. */
export function captureException(error: unknown, extra?: Record<string, unknown>): void {
  if (!isSentryEnabled) return;
  Sentry.captureException(error, { extra });
}

/** Capture a manual message at the given level. */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  extra?: Record<string, unknown>,
): void {
  if (!isSentryEnabled) return;
  Sentry.captureMessage(message, { level, extra });
}

/** Set the currently authenticated user in Sentry scope. */
export function setSentryUser(user: {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  role?: string;
}): void {
  if (!isSentryEnabled) return;
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
  if (user.role) {
    Sentry.setTag('user.role', user.role);
  }
  if (user.phone) {
    Sentry.setExtra('user.phone', user.phone);
  }
}

/** Clear the Sentry user scope (on logout). */
export function clearSentryUser(): void {
  if (!isSentryEnabled) return;
  Sentry.setUser(null);
}

/** Add a breadcrumb for navigation or user action tracking. */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, unknown>;
}): void {
  if (!isSentryEnabled) return;
  Sentry.addBreadcrumb({
    category: breadcrumb.category,
    message: breadcrumb.message,
    level: breadcrumb.level ?? 'info',
    data: breadcrumb.data,
  });
}

/** Set a tag on the current Sentry scope. */
export function setTag(key: string, value: string): void {
  if (!isSentryEnabled) return;
  Sentry.setTag(key, value);
}

/** Set extra context data on the current Sentry scope. */
export function setExtra(key: string, value: unknown): void {
  if (!isSentryEnabled) return;
  Sentry.setExtra(key, value);
}

/** Check whether Sentry is initialised (useful for conditional logging). */
export function isSentryReady(): boolean {
  return isSentryEnabled;
}
