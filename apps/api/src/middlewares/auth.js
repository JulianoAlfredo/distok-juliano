'use strict';

const { verify } = require('../utils/jwt');
const { Errors } = require('../core/errors');
const TenantContext = require('../core/TenantContext');
const knex = require('../db/knex');
const { TENANT_STATUS, ROLES } = require('@distok/shared');

/**
 * preHandler de autenticação (arch §5.3).
 * - Valida o JWT, monta req.ctx (TenantContext) a partir do token (não do cliente).
 * - Revalida status do tenant a cada requisição (NFR4): tenant inativo => bloqueio.
 */
async function authenticate(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw Errors.unauthorized();
  }

  let payload;
  try {
    payload = verify(token);
  } catch {
    throw Errors.unauthorized('Token inválido ou expirado');
  }

  const ctx = new TenantContext({
    tenantId: payload.tid || null,
    userId: payload.sub,
    role: payload.role,
  });

  // Tenant não-super: garantir que o tenant continua ativo.
  if (ctx.role !== ROLES.SUPER_ADMIN) {
    if (!ctx.tenantId) throw Errors.unauthorized();
    const tenant = await knex('tenants').where({ id: ctx.tenantId }).first();
    if (!tenant || tenant.status !== TENANT_STATUS.ACTIVE) {
      throw Errors.tenantInactive();
    }
  }

  req.ctx = ctx;
}

module.exports = { authenticate };
