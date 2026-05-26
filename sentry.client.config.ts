import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    debug: false,
    tracesSampleRate: 0.1,
    replaysIntegration: Sentry.replayIntegration({
      maskAllText: true,
      maskAllInputs: true,
    }),
  });
}
