'use strict';

const Sentry = require('@sentry/node');
const env = require('../config/env');

let enabled = false;

/**
 * Alerting de erro de produção (P1 #5). Sem SENTRY_DSN configurado, isto é um no-op —
 * o app roda normalmente e os erros só ficam no log do processo, como sempre.
 */
function init() {
  if (!env.SENTRY_DSN || env.isTest) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0, // só error tracking, sem performance monitoring
  });
  enabled = true;
}

/** Envia um erro inesperado (500) pro Sentry. Não faz nada se não estiver configurado. */
function captureError(err, extra) {
  if (!enabled) return;
  Sentry.captureException(err, extra ? { extra } : undefined);
}

module.exports = { init, captureError };
