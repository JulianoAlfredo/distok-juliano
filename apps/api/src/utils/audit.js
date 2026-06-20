'use strict';

const { v4: uuid } = require('uuid');
const knex = require('../db/knex');

/**
 * Registra uma ação no audit_log (append-only, NFR14).
 * Aceita trx para participar da mesma transação de negócio (ex.: estoque).
 */
async function record({ ctx, action, entityType, entityId, before, after, ip }, trx) {
  const row = {
    id: uuid(),
    tenant_id: ctx ? ctx.tenantId : null,
    user_id: ctx ? ctx.userId : null,
    action,
    entity_type: entityType || null,
    entity_id: entityId || null,
    before_json: before ? JSON.stringify(before) : null,
    after_json: after ? JSON.stringify(after) : null,
    ip_address: ip || null,
  };
  await (trx || knex)('audit_log').insert(row);
}

module.exports = { record };
