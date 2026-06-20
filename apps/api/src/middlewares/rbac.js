'use strict';

const { Errors } = require('../core/errors');

/**
 * Fábrica de preHandler de autorização por role (RBAC, arch §6.3).
 * Uso: { preHandler: [authenticate, requireRole(ROLES.ADMIN)] }
 */
function requireRole(...allowed) {
  return async function rbac(req) {
    if (!req.ctx) throw Errors.unauthorized();
    if (!allowed.includes(req.ctx.role)) {
      throw Errors.forbidden('Você não tem acesso a este recurso');
    }
  };
}

module.exports = { requireRole };
