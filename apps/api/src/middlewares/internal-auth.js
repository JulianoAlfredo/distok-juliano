'use strict';

const crypto = require('crypto');
const env = require('../config/env');
const { Errors } = require('../core/errors');

/**
 * preHandler dos endpoints internos de cron (/internal/ze-delivery/*). Não é JWT/RBAC — é um
 * segredo compartilhado comparado em tempo constante, porque quem chama é um cron externo
 * varrendo TODOS os tenants, não uma sessão de usuário de um tenant específico.
 */
async function requireInternalSecret(req) {
  const provided = Buffer.from(String(req.headers['x-internal-secret'] || ''));
  const expected = Buffer.from(String(env.zeDelivery.cronSecret || ''));
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    throw Errors.unauthorized();
  }
}

module.exports = { requireInternalSecret };
