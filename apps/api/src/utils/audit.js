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

/**
 * Lista o histórico de auditoria de uma entidade (mais recente primeiro),
 * já com o nome do usuário responsável.
 */
async function history(ctx, entityType, entityId, { limit = 50 } = {}) {
  return knex('audit_log')
    .where({ entity_type: entityType, entity_id: entityId, tenant_id: ctx.tenantId })
    .orderBy('created_at', 'desc')
    .limit(limit)
    .leftJoin('users', 'users.id', 'audit_log.user_id')
    .select(
      'audit_log.id',
      'audit_log.action',
      'audit_log.before_json',
      'audit_log.after_json',
      'audit_log.created_at',
      'users.name as user_name'
    );
}

module.exports = { record, history };
